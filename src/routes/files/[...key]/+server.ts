import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { collections, db, images } from '#lib/server/db';
import { storage } from '#lib/server/storage';
import { currentOwner } from '#lib/server/owner';

const TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp'
};

// Local stand-in for the public bucket: files are served only when their image is visible.
export async function GET({ params, cookies }) {
	const m = /^img\/([A-Za-z0-9]+)\/[A-Za-z0-9_-]+-[a-z0-9]+\.(jpg|png|webp)$/.exec(params.key);
	if (!m) error(404);
	const [image] = await db.select().from(images).where(eq(images.id, m[1]));
	if (!image || image.deletedAt) error(404);
	const [collection] = image.collectionId
		? await db.select().from(collections).where(eq(collections.id, image.collectionId))
		: [];
	if (collection?.deletedAt) error(404);
	if (image.status !== 'approved' || (collection && collection.status !== 'approved')) {
		const owner = await currentOwner(cookies);
		if (owner?.id !== image.ownerId) error(404);
	}
	let data: Buffer;
	try {
		data = await storage.get(params.key);
	} catch {
		error(404);
	}
	return new Response(new Uint8Array(data), {
		headers: {
			'content-type': TYPES[m[2]],
			'cache-control': 'private, max-age=3600'
		}
	});
}

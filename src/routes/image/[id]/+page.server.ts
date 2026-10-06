import { error } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { config } from '#lib/server/config';
import { getCollection, getImage, siblings } from '#lib/server/content';
import { db } from '#lib/server/db';
import { neighbours } from '#lib/server/feed';
import { isAdmin } from '#lib/server/admin';
import { currentOwner } from '#lib/server/owner';
import { entryHref, parseQuery, toParams } from '#lib/query';

export async function load({ params, url, cookies }) {
	const owner = await currentOwner(cookies);
	const data = await getImage(params.id, owner?.id, isAdmin(cookies));
	if (!data) error(404, 'Image not found');
	const { image, collection } = data;

	let prev: string | null = null;
	let next: string | null = null;
	let back = '/';
	if (collection) {
		const c = await getCollection(collection.id, owner?.id, isAdmin(cookies));
		const nav = siblings(c?.images ?? [], image.id);
		prev = nav.prev ? `/image/${nav.prev.id}` : null;
		next = nav.next ? `/image/${nav.next.id}` : null;
		back = `/collection/${collection.id}`;
	} else if (data.live) {
		const { filters, sort } = parseQuery(url.searchParams);
		const ctx = toParams(filters, sort);
		const [row] = await db.execute<{ ca: string }>(
			sql`SELECT created_at::text AS ca FROM images WHERE id = ${image.id}`
		);
		const n = await neighbours(filters, sort, { ca: row.ca, lc: image.likeCount, id: image.id });
		prev = n.prev ? entryHref(n.prev, ctx) : null;
		next = n.next ? entryHref(n.next, ctx) : null;
		back = ctx.size ? `/?${ctx}` : '/';
	}

	return {
		image: {
			id: image.id,
			title: image.title ?? collection?.title ?? 'Untitled',
			description: image.description,
			creditName: image.creditName,
			creditUrl: image.creditUrl,
			submittedBy: image.submittedBy,
			author: image.author,
			sourceMode: image.sourceMode,
			fileKey: image.fileKey,
			leftKey: image.leftKey,
			rightKey: image.rightKey,
			leftW: image.leftW,
			leftH: image.leftH,
			rightW: image.rightW,
			rightH: image.rightH,
			thumbPrefix: image.thumbPrefix,
			thumbW: image.thumbW,
			thumbH: image.thumbH,
			likeCount: image.likeCount,
			status: image.status,
			rejectReason: image.rejectReason
		},
		collection: collection ? { id: collection.id, title: collection.title } : null,
		eff: data.eff,
		tags: data.tags,
		isOwner: data.isOwner,
		isPrivate: data.isPrivate,
		live: data.live,
		liked: data.liked,
		prev,
		next,
		back,
		publicUrl: config.publicUrl
	};
}

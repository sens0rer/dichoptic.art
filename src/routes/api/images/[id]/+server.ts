import { json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { body, fail, guard, zodFail } from '#lib/server/api';
import { db, images } from '#lib/server/db';
import { imageMetaSchema } from '#lib/server/meta';
import { currentOwner } from '#lib/server/owner';
import { pairSchema } from '#lib/server/pair';
import { deleteImage, findDuplicate, preparePair, updateImage } from '#lib/server/submissions';
import { storage } from '#lib/server/storage';

const schema = z.object({
	meta: z.unknown(),
	pair: pairSchema.optional(),
	confirm: z.boolean().optional()
});

async function owned(event: Parameters<typeof PATCH>[0]) {
	const owner = await currentOwner(event.cookies);
	const [image] = await db
		.select()
		.from(images)
		.where(and(eq(images.id, event.params.id), isNull(images.deletedAt)));
	return image && owner && image.ownerId === owner.id ? image : null;
}

export const PATCH = (event) =>
	guard(async () => {
		const image = await owned(event);
		if (!image) return fail(403, 'Only the owner can edit this');
		const parsed = schema.safeParse(await body(event));
		if (!parsed.success) return fail(400, 'Invalid request');
		const meta = imageMetaSchema(!image.collectionId).safeParse(parsed.data.meta);
		if (!meta.success) return zodFail(meta.error);

		const { pair, confirm } = parsed.data;
		const prepared = pair ? await preparePair(pair) : null;
		if (prepared && !confirm) {
			const dup = await findDuplicate(prepared.phash, image.id);
			if (dup) return json({ duplicate: dup });
		}
		const oldKeys = await db.transaction((tx) =>
			updateImage(tx, image, meta.data, prepared && pair ? { prepared, pair } : undefined)
		);
		await Promise.all(oldKeys.map((k) => storage.delete(k)));
		return json({ id: image.id });
	});

export const DELETE = (event) =>
	guard(async () => {
		const image = await owned(event);
		if (!image) return fail(403, 'Only the owner can delete this');
		await db.transaction((tx) => deleteImage(tx, image));
		return json({ ok: true });
	});

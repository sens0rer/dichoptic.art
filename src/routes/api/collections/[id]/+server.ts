import { json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { body, fail, guard, zodFail } from '#lib/server/api';
import { collections, db, images } from '#lib/server/db';
import { collectionMetaSchema } from '#lib/server/meta';
import { currentOwner } from '#lib/server/owner';
import { deleteCollection, updateCollection } from '#lib/server/submissions';

const schema = z.object({ meta: z.unknown(), cover: z.string().nullish() });

async function owned(event: Parameters<typeof PATCH>[0]) {
	const owner = await currentOwner(event.cookies);
	const [c] = await db
		.select()
		.from(collections)
		.where(and(eq(collections.id, event.params.id), isNull(collections.deletedAt)));
	return c && owner && c.ownerId === owner.id ? c : null;
}

export const PATCH = (event) =>
	guard(async () => {
		const c = await owned(event);
		if (!c) return fail(403, 'Only the owner can edit this');
		const parsed = schema.safeParse(await body(event));
		if (!parsed.success) return fail(400, 'Invalid request');
		const meta = collectionMetaSchema.safeParse(parsed.data.meta);
		if (!meta.success) return zodFail(meta.error);

		let cover: string | null = null;
		if (parsed.data.cover) {
			const [img] = await db
				.select({ id: images.id })
				.from(images)
				.where(
					and(
						eq(images.id, parsed.data.cover),
						eq(images.collectionId, c.id),
						isNull(images.deletedAt)
					)
				);
			if (!img) return fail(400, 'Cover must be an image in this collection');
			cover = img.id;
		}
		await db.transaction((tx) => updateCollection(tx, c, meta.data, cover));
		return json({ id: c.id });
	});

export const DELETE = (event) =>
	guard(async () => {
		const c = await owned(event);
		if (!c) return fail(403, 'Only the owner can delete this');
		await db.transaction((tx) => deleteCollection(tx, c.id));
		return json({ ok: true });
	});

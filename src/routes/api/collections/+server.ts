import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { assertNotPaused, recordSubmissions } from '#lib/server/abuse';
import { body, clientIp, fail, guard, zodFail } from '#lib/server/api';
import { db } from '#lib/server/db';
import { collectionMetaSchema, imageMetaSchema, type ImageMeta } from '#lib/server/meta';
import { ensureOwner } from '#lib/server/owner';
import { pairSchema } from '#lib/server/pair';
import type { Prepared } from '#lib/server/process';
import {
	createCollection,
	createImage,
	findDuplicate,
	preparePair,
	setCover
} from '#lib/server/submissions';

const schema = z.object({
	collection: z.unknown(),
	items: z
		.array(z.object({ meta: z.unknown(), pair: pairSchema }))
		.min(1, 'Add at least one pair')
		.max(100),
	cover: z.number().int().min(0).optional(),
	confirm: z.boolean().optional()
});

export const POST = (event) =>
	guard(async () => {
		await assertNotPaused();
		const parsed = schema.safeParse(await body(event));
		if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? 'Invalid request');
		const { items, confirm } = parsed.data;
		const ids = items.flatMap((i) => i.pair.right ? [i.pair.left, i.pair.right] : [i.pair.left]);
		if (new Set(ids).size !== ids.length) return fail(400, 'The same file was added twice');

		const meta = collectionMetaSchema.safeParse(parsed.data.collection);
		if (!meta.success) return zodFail(meta.error);

		const metas: ImageMeta[] = [];
		for (const [index, item] of items.entries()) {
			const m = imageMetaSchema(false).safeParse(item.meta ?? {});
			if (!m.success) return zodFail(m.error, `items.${index}.`);
			metas.push(m.data);
		}

		const prepared: Prepared[] = [];
		for (const item of items) prepared.push(await preparePair(item.pair));

		if (!confirm) {
			const duplicates = [];
			for (const [index, p] of prepared.entries()) {
				const dup = await findDuplicate(p.phash);
				if (dup) duplicates.push({ index, ...dup });
			}
			if (duplicates.length) return json({ duplicates });
		}

		const owner = await ensureOwner(event.cookies, event.request);
		const created = await db.transaction(async (tx) => {
			const collectionId = await createCollection(tx, { ownerId: owner.id, meta: meta.data });
			let cover: string | null = null;
			const imageIds: string[] = [];
			for (const [index, item] of items.entries()) {
				const imageMeta = metas[index];
				const imageId = await createImage(tx, {
					ownerId: owner.id,
					meta: imageMeta,
					prepared: prepared[index],
					pair: item.pair,
					collectionId,
					isPrivate: meta.data.private
				});
				imageIds.push(imageId);
				if (index === (parsed.data.cover ?? 0)) cover = imageId;
			}
			if (cover) await setCover(tx, collectionId, cover);
			return { collectionId, imageIds };
		});
		await recordSubmissions(clientIp(event), [
			{ type: 'collection', id: created.collectionId },
			...created.imageIds.map((id) => ({ type: 'image' as const, id }))
		]);
		return json({ id: created.collectionId, recovery: owner.key });
	});

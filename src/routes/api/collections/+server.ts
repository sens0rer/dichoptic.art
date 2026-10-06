import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { assertNotPaused, recordSubmissions } from '#lib/server/abuse';
import { body, clientIp, fail, guard, zodFail } from '#lib/server/api';
import { db } from '#lib/server/db';
import { collectionMetaSchema, imageMetaSchema } from '#lib/server/meta';
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
		.array(z.object({ title: z.string().max(200).optional(), pair: pairSchema }))
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

		const meta = collectionMetaSchema.safeParse(parsed.data.collection);
		if (!meta.success) return zodFail(meta.error);

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
		const id = await db.transaction(async (tx) => {
			const collectionId = await createCollection(tx, { ownerId: owner.id, meta: meta.data });
			let cover: string | null = null;
			for (const [index, item] of items.entries()) {
				const imageMeta = imageMetaSchema(false).parse({ title: item.title });
				const imageId = await createImage(tx, {
					ownerId: owner.id,
					meta: imageMeta,
					prepared: prepared[index],
					pair: item.pair,
					collectionId
				});
				if (index === (parsed.data.cover ?? 0)) cover = imageId;
			}
			if (cover) await setCover(tx, collectionId, cover);
			return collectionId;
		});
		await recordSubmissions(clientIp(event), 1 + items.length);
		return json({ id, recovery: owner.key });
	});

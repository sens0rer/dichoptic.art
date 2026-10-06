import { json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { assertNotPaused, recordSubmissions } from '#lib/server/abuse';
import { body, clientIp, fail, guard, zodFail } from '#lib/server/api';
import { collections, db } from '#lib/server/db';
import { imageMetaSchema, type ImageMeta } from '#lib/server/meta';
import { currentOwner } from '#lib/server/owner';
import { pairSchema } from '#lib/server/pair';
import type { Prepared } from '#lib/server/process';
import { createImage, findDuplicate, preparePair } from '#lib/server/submissions';

const schema = z.object({
	items: z
		.array(z.object({ meta: z.unknown(), pair: pairSchema }))
		.min(1, 'Add at least one image')
		.max(100),
	confirm: z.boolean().optional()
});

// Bulk-adds pairs to a collection the visitor owns.
export const POST = (event) =>
	guard(async () => {
		await assertNotPaused();
		const owner = await currentOwner(event.cookies);
		const [c] = await db
			.select()
			.from(collections)
			.where(and(eq(collections.id, event.params.id), isNull(collections.deletedAt)));
		if (!c || !owner || c.ownerId !== owner.id)
			return fail(403, 'You can only add to collections you own');

		const parsed = schema.safeParse(await body(event));
		if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? 'Invalid request');
		const { items, confirm } = parsed.data;
		const ids = items.flatMap((i) => i.pair.right ? [i.pair.left, i.pair.right] : [i.pair.left]);
		if (new Set(ids).size !== ids.length) return fail(400, 'The same file was added twice');

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

		const imageIds = await db.transaction(async (tx) => {
			const created: string[] = [];
			for (const [index, item] of items.entries())
				created.push(
					await createImage(tx, {
						ownerId: owner.id,
						meta: metas[index],
						prepared: prepared[index],
						pair: item.pair,
						collectionId: c.id,
						isPrivate: c.private
					})
				);
			return created;
		});
		await recordSubmissions(
			clientIp(event),
			imageIds.map((id) => ({ type: 'image' as const, id }))
		);
		return json({ id: c.id, recovery: owner.key });
	});

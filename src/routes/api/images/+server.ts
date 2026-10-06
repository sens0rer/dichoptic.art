import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { assertNotPaused, recordSubmissions } from '#lib/server/abuse';
import { body, clientIp, fail, guard, zodFail } from '#lib/server/api';
import { collections, db } from '#lib/server/db';
import { imageMetaSchema } from '#lib/server/meta';
import { currentOwner, ensureOwner } from '#lib/server/owner';
import { pairSchema } from '#lib/server/pair';
import { createImage, findDuplicate, preparePair } from '#lib/server/submissions';

const schema = z.object({
	meta: z.unknown(),
	pair: pairSchema,
	collectionId: z.string().optional(),
	confirm: z.boolean().optional()
});

export const POST = (event) =>
	guard(async () => {
		await assertNotPaused();
		const parsed = schema.safeParse(await body(event));
		if (!parsed.success) return fail(400, 'Invalid request');
		const { pair, collectionId, confirm } = parsed.data;

		const meta = imageMetaSchema(!collectionId).safeParse(parsed.data.meta);
		if (!meta.success) return zodFail(meta.error);

		if (collectionId) {
			const owner = await currentOwner(event.cookies);
			const [c] = await db.select().from(collections).where(eq(collections.id, collectionId));
			if (!c || c.deletedAt || c.ownerId !== owner?.id)
				return fail(403, 'You can only add to collections you own');
		}

		const prepared = await preparePair(pair);
		if (!confirm) {
			const dup = await findDuplicate(prepared.phash);
			if (dup) return json({ duplicate: dup });
		}

		const owner = await ensureOwner(event.cookies, event.request);
		const id = await db.transaction((tx) =>
			createImage(tx, { ownerId: owner.id, meta: meta.data, prepared, pair, collectionId })
		);
		await recordSubmissions(clientIp(event));
		return json({ id, recovery: owner.key });
	});

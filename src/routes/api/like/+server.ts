import { json } from '@sveltejs/kit';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { body, fail, guard } from '#lib/server/api';
import { getCollection, getImage } from '#lib/server/content';
import { collections, db, images, likes } from '#lib/server/db';
import { ensureOwner, hasConsent } from '#lib/server/owner';

const schema = z.object({ type: z.enum(['image', 'collection']), id: z.string() });

// Toggles the visitor's like and returns the new state. Likes need the owner cookie, so they
// are refused without consent.
export const POST = (event) =>
	guard(async () => {
		const parsed = schema.safeParse(await body(event));
		if (!parsed.success) return fail(400, 'Invalid request');
		const { type, id } = parsed.data;
		if (!hasConsent(event.request))
			return fail(403, 'Accept cookies to like', { consent: true });

		const target =
			type === 'image'
				? (await getImage(id, undefined))?.live
				: (await getCollection(id, undefined))?.live;
		if (!target) return fail(404, 'Not found');

		const owner = await ensureOwner(event.cookies, event.request);
		const table = type === 'image' ? images : collections;
		const result = await db.transaction(async (tx) => {
			const key = and(eq(likes.ownerId, owner.id), eq(likes.targetType, type), eq(likes.targetId, id));
			const removed = await tx.delete(likes).where(key).returning();
			const liked = removed.length === 0;
			if (liked) await tx.insert(likes).values({ ownerId: owner.id, targetType: type, targetId: id });
			const [row] = await tx
				.update(table)
				.set({ likeCount: sql`${table.likeCount} + ${liked ? 1 : -1}` })
				.where(and(eq(table.id, id), isNull(table.deletedAt)))
				.returning({ count: table.likeCount });
			return { liked, count: row.count };
		});
		return json(result);
	});

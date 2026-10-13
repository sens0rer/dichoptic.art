import { and, eq, isNull, sql } from 'drizzle-orm';
import { collections, db, images, likes, owners, type Tx } from './db';

// What an owner has on the site, to decide whether opening a recovery link needs a confirmation.
export async function holdings(ownerId: string) {
	const count = async (table: typeof images | typeof collections) => {
		const [row] = await db
			.select({ n: sql<number>`count(*)::int` })
			.from(table)
			.where(and(eq(table.ownerId, ownerId), isNull(table.deletedAt)));
		return row.n;
	};
	const [likeRow] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(likes)
		.where(eq(likes.ownerId, ownerId));
	const [imageCount, collectionCount] = await Promise.all([count(images), count(collections)]);
	return { images: imageCount, collections: collectionCount, likes: likeRow.n };
}

export const hasHoldings = (h: Awaited<ReturnType<typeof holdings>>) =>
	h.images + h.collections + h.likes > 0;

// Moves everything of `from` onto `to`. Likes both made on the same target are counted once.
export async function mergeOwner(tx: Tx, from: string, to: string) {
	await tx.update(images).set({ ownerId: to }).where(eq(images.ownerId, from));
	await tx.update(collections).set({ ownerId: to }).where(eq(collections.ownerId, from));
	await tx.execute(sql`
		WITH dup AS (
			DELETE FROM likes a USING likes b
			WHERE a.owner_id = ${from} AND b.owner_id = ${to}
				AND a.target_type = b.target_type AND a.target_id = b.target_id
			RETURNING a.target_type, a.target_id
		), fix_images AS (
			UPDATE images SET like_count = like_count - 1
			WHERE id IN (SELECT target_id FROM dup WHERE target_type = 'image') RETURNING 1
		)
		UPDATE collections SET like_count = like_count - 1
		WHERE id IN (SELECT target_id FROM dup WHERE target_type = 'collection')`);
	await tx.update(likes).set({ ownerId: to }).where(eq(likes.ownerId, from));
	// The old key keeps working: it now resolves to `to`.
	await tx.update(owners).set({ mergedInto: to }).where(eq(owners.id, from));
	await tx.update(owners).set({ mergedInto: to }).where(eq(owners.mergedInto, from));
}

import { and, desc, eq, isNull } from 'drizzle-orm';
import { isPaused } from '#lib/server/abuse';
import { chromacyPresets } from '#lib/server/content';
import { collections, db } from '#lib/server/db';
import { currentOwner } from '#lib/server/owner';

export async function load({ cookies, url }) {
	const owner = await currentOwner(cookies);
	const mine = owner
		? await db
				.select({ id: collections.id, title: collections.title })
				.from(collections)
				.where(and(eq(collections.ownerId, owner.id), isNull(collections.deletedAt)))
				.orderBy(desc(collections.createdAt))
		: [];
	return {
		presets: await chromacyPresets(),
		myCollections: mine,
		into: url.searchParams.get('collection'),
		paused: await isPaused()
	};
}

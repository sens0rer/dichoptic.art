import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import {
	chromacyTypes,
	collections,
	collectionTags,
	db,
	imageTags,
	images,
	likes,
	tags
} from './db';

export type ImageRow = typeof images.$inferSelect;
export type CollectionRow = typeof collections.$inferSelect;

async function imageTagNames(id: string): Promise<string[]> {
	const rows = await db
		.select({ name: tags.name })
		.from(imageTags)
		.innerJoin(tags, eq(tags.id, imageTags.tagId))
		.where(eq(imageTags.imageId, id));
	return rows.map((r) => r.name).sort();
}

async function collectionTagNames(id: string): Promise<string[]> {
	const rows = await db
		.select({ name: tags.name })
		.from(collectionTags)
		.innerJoin(tags, eq(tags.id, collectionTags.tagId))
		.where(eq(collectionTags.collectionId, id));
	return rows.map((r) => r.name).sort();
}

export const hasLiked = async (ownerId: string | undefined, type: 'image' | 'collection', id: string) => {
	if (!ownerId) return false;
	const [row] = await db
		.select({ x: sql<number>`1` })
		.from(likes)
		.where(and(eq(likes.ownerId, ownerId), eq(likes.targetType, type), eq(likes.targetId, id)));
	return !!row;
};

// Unapproved and private content is only visible to its owner (or an admin); deleted content is visible to nobody.
export async function getImage(id: string, ownerId?: string, admin = false) {
	const [image] = await db.select().from(images).where(eq(images.id, id));
	if (!image || image.deletedAt) return null;
	const collection = image.collectionId
		? ((await db.select().from(collections).where(eq(collections.id, image.collectionId)))[0] ?? null)
		: null;
	if (collection?.deletedAt) return null;
	const isOwner = !!ownerId && image.ownerId === ownerId;
	const isPrivate = image.private || !!collection?.private;
	const live =
		image.status === 'approved' &&
		(!collection || collection.status === 'approved') &&
		!isPrivate;
	if (!live && !isOwner && !admin) return null;

	const own = await imageTagNames(id);
	const inherited = collection ? await collectionTagNames(collection.id) : [];
	const eff = {
		dimension: image.dimension ?? collection?.dimension ?? null,
		medium: image.medium ?? collection?.medium ?? null,
		alteration: image.alteration ?? collection?.alteration ?? null,
		chromacy: image.chromacy ?? collection?.chromacy ?? null,
		chromacyType: image.chromacyType ?? collection?.chromacyType ?? null,
		filterInfo: image.filterInfo ?? collection?.filterInfo ?? null,
		date: image.date ?? collection?.date ?? image.createdAt.toISOString().slice(0, 10)
	};
	return {
		image,
		collection,
		eff,
		ownTags: own,
		tags: [...new Set([...own, ...inherited])].sort(),
		isOwner,
		isPrivate,
		live,
		liked: !live ? false : await hasLiked(ownerId, 'image', id)
	};
}

export async function getCollection(id: string, ownerId?: string, admin = false) {
	const [collection] = await db.select().from(collections).where(eq(collections.id, id));
	if (!collection || collection.deletedAt) return null;
	const isOwner = !!ownerId && collection.ownerId === ownerId;
	const all = await db
		.select()
		.from(images)
		.where(and(eq(images.collectionId, id), isNull(images.deletedAt)))
		.orderBy(asc(images.createdAt), asc(images.id));
	const visible = all.filter((i) => i.status === 'approved');
	const live = collection.status === 'approved' && visible.length > 0 && !collection.private;
	if (!live && !isOwner && !admin) return null;
	return {
		collection,
		images: isOwner || admin ? all : visible,
		tags: await collectionTagNames(id),
		isOwner,
		isPrivate: collection.private,
		live,
		liked: !live ? false : await hasLiked(ownerId, 'collection', id)
	};
}

// Previous/next within a collection, ordered as the grid is.
export function siblings(list: { id: string }[], id: string) {
	const at = list.findIndex((i) => i.id === id);
	return { prev: list[at - 1] ?? null, next: list[at + 1] ?? null };
}

export async function chromacyPresets() {
	return db.select().from(chromacyTypes).orderBy(asc(chromacyTypes.code));
}

export async function suggestTags(prefix: string, limit = 8): Promise<string[]> {
	const p = prefix.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
	const rows = await db
		.select({ name: tags.name })
		.from(tags)
		.where(
			sql`${tags.name} LIKE ${p + '%'} AND (
				EXISTS (SELECT 1 FROM image_tags it JOIN images i ON i.id = it.image_id
					WHERE it.tag_id = ${tags.id} AND i.deleted_at IS NULL AND i.status = 'approved' AND NOT i.private)
				OR EXISTS (SELECT 1 FROM collection_tags ct JOIN collections c ON c.id = ct.collection_id
					WHERE ct.tag_id = ${tags.id} AND c.deleted_at IS NULL AND c.status = 'approved' AND NOT c.private))`
		)
		.orderBy(asc(tags.name))
		.limit(limit);
	return rows.map((r) => r.name);
}

export async function mySubmissions(ownerId: string) {
	const [imgs, cols] = await Promise.all([
		db
			.select()
			.from(images)
			.where(and(eq(images.ownerId, ownerId), isNull(images.deletedAt), isNull(images.collectionId)))
			.orderBy(desc(images.createdAt)),
		db
			.select()
			.from(collections)
			.where(and(eq(collections.ownerId, ownerId), isNull(collections.deletedAt)))
			.orderBy(desc(collections.createdAt))
	]);
	const members = cols.length
		? await db
				.select()
				.from(images)
				.where(and(inArray(images.collectionId, cols.map((c) => c.id)), isNull(images.deletedAt)))
				.orderBy(asc(images.createdAt), asc(images.id))
		: [];
	return {
		images: imgs,
		collections: cols.map((c) => {
			const mine = members.filter((m) => m.collectionId === c.id);
			const cover = mine.find((m) => m.id === c.coverImageId) ?? mine[0];
			return { ...c, count: mine.length, thumbPrefix: cover?.thumbPrefix ?? null };
		})
	};
}

export async function pendingQueue() {
	const [cols, imgs] = await Promise.all([
		db
			.select()
			.from(collections)
			.where(
				and(
					eq(collections.status, 'pending'),
					isNull(collections.deletedAt),
					eq(collections.private, false)
				)
			)
			.orderBy(asc(collections.createdAt)),
		// Pending images that stand alone or sit in an already-approved collection.
		db
			.select({ image: images })
			.from(images)
			.leftJoin(collections, eq(collections.id, images.collectionId))
			.where(
				and(
					isNull(images.deletedAt),
					eq(images.status, 'pending'),
					eq(images.private, false),
					or(
						isNull(images.collectionId),
						and(eq(collections.status, 'approved'), isNull(collections.deletedAt))
					)
				)
			)
			.orderBy(asc(images.createdAt))
	]);
	const members = cols.length
		? await db
				.select()
				.from(images)
				.where(and(inArray(images.collectionId, cols.map((c) => c.id)), isNull(images.deletedAt)))
				.orderBy(asc(images.createdAt))
		: [];
	return {
		collections: cols.map((c) => ({ ...c, images: members.filter((m) => m.collectionId === c.id) })),
		images: imgs.map((r) => r.image)
	};
}

export async function privateSubmissions() {
	const [imgs, cols] = await Promise.all([
		db
			.select()
			.from(images)
			.where(and(eq(images.private, true), isNull(images.deletedAt), isNull(images.collectionId)))
			.orderBy(desc(images.createdAt))
			.limit(100),
		db
			.select()
			.from(collections)
			.where(and(eq(collections.private, true), isNull(collections.deletedAt)))
			.orderBy(desc(collections.createdAt))
			.limit(100)
	]);
	return { images: imgs, collections: cols };
}

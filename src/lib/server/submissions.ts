import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { plainText } from '../links';
import { moderationOn } from './settings';
import {
	collections,
	collectionTags,
	db,
	imageTags,
	images,
	tags,
	type Db,
	type Tx
} from './db';
import { newFileId, newId } from './ids';
import type { CollectionMeta, ImageMeta } from './meta';
import {
	HASH_COLOUR_BITS,
	HASH_STRUCTURE_BITS,
	prepare,
	UploadError,
	type Prepared
} from './process';
import { imageKeys, storePair } from './store';
import { storage } from './storage';
import type { SourceMode } from '../vocab';

export const DUPLICATE_STRUCTURE_DISTANCE = 6;
// 4 bits per value: about 12 values moved by one of 16 levels. Recompressing barely moves any.
export const DUPLICATE_COLOUR_DISTANCE = 12;
const TMP_ID = /^[A-Za-z0-9_-]{16,40}$/;

export interface PairInput {
	mode: SourceMode;
	left: string; // tmp upload id
	right?: string;
}

const tmpKey = (id: string) => {
	if (!TMP_ID.test(id)) throw new UploadError('Invalid upload reference');
	return `tmp/${id}`;
};

async function readTmp(id: string): Promise<Buffer> {
	try {
		return await storage.get(tmpKey(id));
	} catch (e) {
		if (e instanceof UploadError) throw e;
		throw new UploadError('An upload expired or was already used. Please add the files again.');
	}
}

export async function preparePair(input: PairInput): Promise<Prepared> {
	const left = await readTmp(input.left);
	const right = input.mode === 'two_files' && input.right ? await readTmp(input.right) : undefined;
	return prepare(input.mode, { left, right });
}

export const visibleImageSql = sql`(i.deleted_at IS NULL AND i.status = 'approved' AND NOT i.private AND (i.collection_id IS NULL OR EXISTS (
	SELECT 1 FROM collections vc WHERE vc.id = i.collection_id AND vc.deleted_at IS NULL AND vc.status = 'approved' AND NOT vc.private)))`;

// A duplicate has the same picture AND the same colours: both parts of the fingerprint must be close.
export async function findDuplicate(phash: string, ignoreId?: string) {
	const structure = phash.slice(0, HASH_STRUCTURE_BITS);
	const colour = phash.slice(HASH_STRUCTURE_BITS);
	const rows = await db.execute<{ id: string; title: string | null }>(sql`
		SELECT i.id, i.title FROM images i
		WHERE ${visibleImageSql}
			AND bit_count(substring(i.phash from 1 for ${HASH_STRUCTURE_BITS}) # ${structure}::bit(${sql.raw(String(HASH_STRUCTURE_BITS))})) <= ${DUPLICATE_STRUCTURE_DISTANCE}
			AND bit_count(substring(i.phash from ${HASH_STRUCTURE_BITS + 1} for ${HASH_COLOUR_BITS}) # ${colour}::bit(${sql.raw(String(HASH_COLOUR_BITS))})) <= ${DUPLICATE_COLOUR_DISTANCE}
			${ignoreId ? sql`AND i.id <> ${ignoreId}` : sql``}
		ORDER BY bit_count(substring(i.phash from 1 for ${HASH_STRUCTURE_BITS}) # ${structure}::bit(${sql.raw(String(HASH_STRUCTURE_BITS))})) LIMIT 1`);
	return rows[0] ?? null;
}

type Reader = Db | Tx;

async function tagIds(tx: Reader, names: string[]): Promise<number[]> {
	if (!names.length) return [];
	await tx
		.insert(tags)
		.values(names.map((name) => ({ name })))
		.onConflictDoNothing();
	const rows = await tx.select({ id: tags.id }).from(tags).where(inArray(tags.name, names));
	return rows.map((r) => r.id);
}

async function setImageTags(tx: Reader, imageId: string, names: string[]) {
	await tx.delete(imageTags).where(eq(imageTags.imageId, imageId));
	const ids = await tagIds(tx, names);
	if (ids.length) await tx.insert(imageTags).values(ids.map((tagId) => ({ imageId, tagId })));
}

async function setCollectionTags(tx: Reader, collectionId: string, names: string[]) {
	await tx.delete(collectionTags).where(eq(collectionTags.collectionId, collectionId));
	const ids = await tagIds(tx, names);
	if (ids.length)
		await tx.insert(collectionTags).values(ids.map((tagId) => ({ collectionId, tagId })));
}

const searchText = (parts: (string | null)[], tagNames: string[]) =>
	[...parts, ...tagNames].filter(Boolean).join(' ');

const imageSearch = (m: ImageMeta) =>
	searchText([m.title, plainText(m.description), plainText(m.credit), m.submittedBy, m.author], m.tags);

const collectionSearch = (m: CollectionMeta) =>
	searchText([m.title, plainText(m.description), plainText(m.credit), m.submittedBy, m.author], m.tags);

async function effectiveMedium(tx: Reader, collectionId: string | null, own: string | null) {
	if (own || !collectionId) return own;
	const [c] = await tx
		.select({ medium: collections.medium })
		.from(collections)
		.where(eq(collections.id, collectionId));
	return c?.medium ?? null;
}

// Private items are never reviewed; they are queued only when made public.
const today = () => new Date().toISOString().slice(0, 10);

const initialStatus = async (isPrivate: boolean) =>
	(await moderationOn()) && !isPrivate ? ('pending' as const) : ('approved' as const);

export async function createImage(
	tx: Tx,
	args: {
		ownerId: string;
		meta: ImageMeta;
		prepared: Prepared;
		pair: PairInput;
		collectionId?: string;
		// Images inside a collection follow the collection's privacy.
		isPrivate?: boolean;
	}
): Promise<string> {
	const { meta, prepared } = args;
	const id = newId();
	const stored = await storePair(id, newFileId(), prepared, {
		left: tmpKey(args.pair.left),
		right: args.pair.right ? tmpKey(args.pair.right) : undefined
	});
	const medium = await effectiveMedium(tx, args.collectionId ?? null, meta.medium);
	const isPrivate = args.collectionId ? !!args.isPrivate : meta.private;
	await tx.insert(images).values({
		id,
		title: meta.title,
		description: meta.description,
		credit: meta.credit,
		submittedBy: meta.submittedBy,
		author: meta.author,
		dimension: meta.dimension,
		medium: meta.medium,
		alteration: meta.alteration,
		chromacy: meta.chromacy,
		chromacyType: meta.chromacyType,
		filterInfo: medium === 'photography' ? meta.filterInfo : null,
		// Pairs inside a collection inherit its date when they have none.
		date: meta.date ?? (args.collectionId ? null : today()),
		sourceMode: prepared.mode,
		...stored,
		phash: prepared.phash,
		collectionId: args.collectionId ?? null,
		ownerId: args.ownerId,
		searchText: imageSearch(meta),
		private: isPrivate,
		status: await initialStatus(isPrivate)
	});
	await setImageTags(tx, id, meta.tags);
	return id;
}

// Making something public puts it in the review queue when moderation is on.
async function privacyChange(current: { private: boolean }, next: boolean) {
	if (current.private === next) return {};
	return {
		private: next,
		...(!next && (await moderationOn()) ? { status: 'pending' as const } : {})
	};
}

export async function updateImage(
	tx: Tx,
	image: typeof images.$inferSelect,
	meta: ImageMeta,
	replacement?: { prepared: Prepared; pair: PairInput }
) {
	const medium = await effectiveMedium(tx, image.collectionId, meta.medium);
	let files: Partial<typeof images.$inferInsert> = {};
	let oldKeys: string[] = [];
	if (replacement) {
		oldKeys = imageKeys(image);
		files = {
			sourceMode: replacement.prepared.mode,
			...(await storePair(image.id, newFileId(), replacement.prepared, {
				left: tmpKey(replacement.pair.left),
				right: replacement.pair.right ? tmpKey(replacement.pair.right) : undefined
			})),
			phash: replacement.prepared.phash
		};
	}
	await tx
		.update(images)
		.set({
			title: meta.title,
			description: meta.description,
			credit: meta.credit,
			submittedBy: meta.submittedBy,
			author: meta.author,
			dimension: meta.dimension,
			medium: meta.medium,
			alteration: meta.alteration,
			chromacy: meta.chromacy,
			chromacyType: meta.chromacyType,
			filterInfo: medium === 'photography' ? meta.filterInfo : null,
			date: meta.date ?? (image.collectionId ? null : image.createdAt.toISOString().slice(0, 10)),
			searchText: imageSearch(meta),
			// Pairs inside a collection follow the collection's privacy.
			...(image.collectionId ? {} : await privacyChange(image, meta.private)),
			...files
		})
		.where(eq(images.id, image.id));
	await setImageTags(tx, image.id, meta.tags);
	return oldKeys;
}

export async function createCollection(
	tx: Tx,
	args: { ownerId: string; meta: CollectionMeta }
): Promise<string> {
	const id = newId();
	const { meta } = args;
	await tx.insert(collections).values({
		id,
		title: meta.title,
		description: meta.description,
		credit: meta.credit,
		submittedBy: meta.submittedBy,
		author: meta.author,
		dimension: meta.dimension,
		medium: meta.medium,
		alteration: meta.alteration,
		chromacy: meta.chromacy,
		chromacyType: meta.chromacyType,
		filterInfo: meta.medium === 'photography' ? meta.filterInfo : null,
		date: meta.date ?? today(),
		ownerId: args.ownerId,
		searchText: collectionSearch(meta),
		private: meta.private,
		status: await initialStatus(meta.private)
	});
	await setCollectionTags(tx, id, meta.tags);
	return id;
}

export async function updateCollection(
	tx: Tx,
	current: typeof collections.$inferSelect,
	meta: CollectionMeta,
	coverImageId: string | null
) {
	const id = current.id;
	const change = await privacyChange(current, meta.private);
	if ('private' in change)
		await tx.update(images).set({ private: meta.private }).where(eq(images.collectionId, id));
	await tx
		.update(collections)
		.set({
			title: meta.title,
			description: meta.description,
			credit: meta.credit,
			submittedBy: meta.submittedBy,
			author: meta.author,
			dimension: meta.dimension,
			medium: meta.medium,
			alteration: meta.alteration,
			chromacy: meta.chromacy,
			chromacyType: meta.chromacyType,
			filterInfo: meta.medium === 'photography' ? meta.filterInfo : null,
			date: meta.date ?? current.createdAt.toISOString().slice(0, 10),
			searchText: collectionSearch(meta),
			...change,
			...(coverImageId ? { coverImageId } : {})
		})
		.where(eq(collections.id, id));
	await setCollectionTags(tx, id, meta.tags);
}

export const setCover = (tx: Tx, collectionId: string, imageId: string) =>
	tx.update(collections).set({ coverImageId: imageId }).where(eq(collections.id, collectionId));

// Soft delete: rows stay, files stay; only deleted_at is set.
export async function deleteImage(tx: Tx, image: typeof images.$inferSelect) {
	await tx.update(images).set({ deletedAt: new Date() }).where(eq(images.id, image.id));
	if (!image.collectionId) return;
	const remaining = await tx
		.select({ id: images.id })
		.from(images)
		.where(and(eq(images.collectionId, image.collectionId), isNull(images.deletedAt)))
		.orderBy(asc(images.createdAt), asc(images.id));
	if (!remaining.length) {
		await tx
			.update(collections)
			.set({ deletedAt: new Date() })
			.where(eq(collections.id, image.collectionId));
		return;
	}
	const [c] = await tx.select().from(collections).where(eq(collections.id, image.collectionId));
	if (c?.coverImageId === image.id)
		await tx
			.update(collections)
			.set({ coverImageId: remaining[0].id })
			.where(eq(collections.id, c.id));
}

export async function deleteCollection(tx: Tx, id: string) {
	const now = new Date();
	await tx.update(images).set({ deletedAt: now }).where(and(eq(images.collectionId, id), isNull(images.deletedAt)));
	await tx.update(collections).set({ deletedAt: now }).where(eq(collections.id, id));
}

// Moderation. Approving a collection approves its pending images as of now.
export async function approveCollection(tx: Tx, id: string) {
	await tx
		.update(collections)
		.set({ status: 'approved', rejectReason: null })
		.where(eq(collections.id, id));
	await tx
		.update(images)
		.set({ status: 'approved', rejectReason: null })
		.where(and(eq(images.collectionId, id), eq(images.status, 'pending')));
}

export const rejectCollection = (tx: Tx, id: string, reason: string | null) =>
	tx.update(collections).set({ status: 'rejected', rejectReason: reason }).where(eq(collections.id, id));

export const approveImage = (tx: Tx, id: string) =>
	tx.update(images).set({ status: 'approved', rejectReason: null }).where(eq(images.id, id));

export const rejectImage = (tx: Tx, id: string, reason: string | null) =>
	tx.update(images).set({ status: 'rejected', rejectReason: reason }).where(eq(images.id, id));

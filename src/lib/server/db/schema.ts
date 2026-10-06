import { sql } from 'drizzle-orm';
import {
	bigserial,
	customType,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import {
	ALTERATIONS,
	CHROMACIES,
	DIMENSIONS,
	MEDIUMS,
	SOURCE_MODES,
	STATUSES
} from '../../vocab';

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });
const bit64 = customType<{ data: string }>({ dataType: () => 'bit(64)' });

export const dimensionEnum = pgEnum('dimension', DIMENSIONS);
export const mediumEnum = pgEnum('medium', MEDIUMS);
export const alterationEnum = pgEnum('alteration', ALTERATIONS);
export const chromacyEnum = pgEnum('chromacy', CHROMACIES);
export const sourceModeEnum = pgEnum('source_mode', SOURCE_MODES);
export const statusEnum = pgEnum('status', STATUSES);

const timestamps = () => ({
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// Fields shared by images and collections. Nullable everywhere: on an image, null inherits the
// collection master; on a standalone image or a master, null means "not specified".
const classification = () => ({
	dimension: dimensionEnum('dimension'),
	medium: mediumEnum('medium'),
	alteration: alterationEnum('alteration'),
	chromacy: chromacyEnum('chromacy'),
	chromacyType: text('chromacy_type'),
	filterInfo: text('filter_info')
});

const credit = () => ({
	creditName: text('credit_name'),
	creditUrl: text('credit_url'),
	submittedBy: text('submitted_by'),
	author: text('author')
});

const moderation = () => ({
	status: statusEnum('status').notNull().default('approved'),
	rejectReason: text('reject_reason'),
	deletedAt: timestamp('deleted_at', { withTimezone: true })
});

export const owners = pgTable('owners', {
	id: text('id').primaryKey(),
	keyHash: text('key_hash').notNull().unique(),
	...timestamps()
});

export const chromacyTypes = pgTable('chromacy_types', {
	code: text('code').primaryKey(),
	name: text('name').notNull(),
	chromacy: chromacyEnum('chromacy').notNull()
});

export const collections = pgTable(
	'collections',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		description: text('description'),
		...credit(),
		...classification(),
		coverImageId: text('cover_image_id'),
		ownerId: text('owner_id')
			.notNull()
			.references(() => owners.id),
		likeCount: integer('like_count').notNull().default(0),
		searchText: text('search_text').notNull().default(''),
		search: tsvector('search').generatedAlwaysAs(sql`to_tsvector('simple', search_text)`),
		...moderation(),
		...timestamps()
	},
	(t) => [index('collections_search_idx').using('gin', t.search), index().on(t.ownerId)]
);

export const images = pgTable(
	'images',
	{
		id: text('id').primaryKey(),
		title: text('title'),
		description: text('description'),
		...credit(),
		...classification(),
		sourceMode: sourceModeEnum('source_mode').notNull(),
		// Exactly one of fileKey (single_file) or leftKey + rightKey (two_files) is set.
		fileKey: text('file_key'),
		leftKey: text('left_key'),
		rightKey: text('right_key'),
		// Width/height of each stored file; the right side is null for a single file.
		leftW: integer('left_w').notNull(),
		leftH: integer('left_h').notNull(),
		rightW: integer('right_w'),
		rightH: integer('right_h'),
		// Thumbnails of the side-by-side pair live at <thumbPrefix>-400.webp, -800, -1600.
		thumbPrefix: text('thumb_prefix').notNull(),
		thumbW: integer('thumb_w').notNull(),
		thumbH: integer('thumb_h').notNull(),
		phash: bit64('phash').notNull(),
		collectionId: text('collection_id').references(() => collections.id),
		ownerId: text('owner_id')
			.notNull()
			.references(() => owners.id),
		likeCount: integer('like_count').notNull().default(0),
		searchText: text('search_text').notNull().default(''),
		search: tsvector('search').generatedAlwaysAs(sql`to_tsvector('simple', search_text)`),
		...moderation(),
		...timestamps()
	},
	(t) => [
		index('images_search_idx').using('gin', t.search),
		index().on(t.collectionId),
		index().on(t.ownerId),
		index().on(t.createdAt)
	]
);

export const tags = pgTable('tags', {
	id: serial('id').primaryKey(),
	name: text('name').notNull().unique()
});

export const imageTags = pgTable(
	'image_tags',
	{
		imageId: text('image_id')
			.notNull()
			.references(() => images.id),
		tagId: integer('tag_id')
			.notNull()
			.references(() => tags.id)
	},
	(t) => [primaryKey({ columns: [t.imageId, t.tagId] })]
);

export const collectionTags = pgTable(
	'collection_tags',
	{
		collectionId: text('collection_id')
			.notNull()
			.references(() => collections.id),
		tagId: integer('tag_id')
			.notNull()
			.references(() => tags.id)
	},
	(t) => [primaryKey({ columns: [t.collectionId, t.tagId] })]
);

export const likes = pgTable(
	'likes',
	{
		ownerId: text('owner_id')
			.notNull()
			.references(() => owners.id),
		targetType: text('target_type', { enum: ['image', 'collection'] }).notNull(),
		targetId: text('target_id').notNull(),
		...timestamps()
	},
	(t) => [uniqueIndex('likes_unique').on(t.ownerId, t.targetType, t.targetId)]
);

export const submissionLog = pgTable(
	'submission_log',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		clientIp: text('client_ip').notNull(),
		// What was submitted, so /admin can list a flagged client's recent work.
		targetType: text('target_type', { enum: ['image', 'collection'] }).notNull(),
		targetId: text('target_id').notNull(),
		...timestamps()
	},
	(t) => [index().on(t.createdAt), index().on(t.clientIp, t.createdAt)]
);

// key 'paused' -> { since }, key 'flagged:<ip>' -> { since, count }
export const siteState = pgTable('site_state', {
	key: text('key').primaryKey(),
	value: jsonb('value').notNull()
});

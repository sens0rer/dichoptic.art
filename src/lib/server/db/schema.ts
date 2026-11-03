import { sql } from 'drizzle-orm';
import {
	bigserial,
	date,
	boolean,
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
const bit256 = customType<{ data: string }>({ dataType: () => 'bit(256)' });

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
	filterInfo: text('filter_info'),
	// Day the work was made or taken (shown on the page). Posting order always uses created_at.
	date: date('date', { mode: 'string' })
});

const credit = () => ({
	// Free text; words can be linked as [word](address). See lib/credit.ts.
	credit: text('credit'),
	submittedBy: text('submitted_by'),
	author: text('author')
});

const moderation = () => ({
	// Private: visible only to the owner and admins, never listed, searched or liked.
	private: boolean('private').notNull().default(false),
	status: statusEnum('status').notNull().default('approved'),
	rejectReason: text('reject_reason'),
	deletedAt: timestamp('deleted_at', { withTimezone: true })
});

export const owners = pgTable('owners', {
	id: text('id').primaryKey(),
	keyHash: text('key_hash').notNull().unique(),
	// Set when this owner was combined into another via a recovery link; the old key then acts as the new owner.
	mergedInto: text('merged_into'),
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
		// Bytes stored for this pair (originals + thumbnails), for the storage cap.
		bytes: integer('bytes').notNull().default(0),
		phash: bit256('phash').notNull(),
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

// Bytes each client has asked to upload, to cap what unsubmitted tmp/ files can add up to.
export const uploadLog = pgTable(
	'upload_log',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		clientIp: text('client_ip').notNull(),
		bytes: integer('bytes').notNull(),
		...timestamps()
	},
	(t) => [index().on(t.clientIp, t.createdAt)]
);

// /synesthesia: a test suite for one participant, unlisted. Tables are separate from the
// main site's and share nothing with it.

// One row per browser (the participant cookie). `position` is where she left off.
export const synParticipants = pgTable('syn_participants', {
	id: text('id').primaryKey(),
	position: jsonb('position'),
	...timestamps()
});

// The pools. Rows are never updated: the id is a hash of the content, so an answer always
// points at the exact text that was shown. `hidden` only keeps an item out of new rounds.
export const synStimuli = pgTable(
	'syn_stimuli',
	{
		id: text('id').primaryKey(),
		category: text('category').notNull(),
		// What one "part" is when checking that an item is fully marked.
		unit: text('unit', { enum: ['word', 'char', 'math'] }).notNull(),
		lang: text('lang'),
		title: text('title'),
		body: text('body').notNull(),
		source: jsonb('source'),
		hidden: boolean('hidden').notNull().default(false),
		...timestamps()
	},
	(t) => [index().on(t.category)]
);

// One visit (a page load in one tab), with the device it ran on.
export const synSessions = pgTable('syn_sessions', {
	id: text('id').primaryKey(),
	participantId: text('participant_id')
		.notNull()
		.references(() => synParticipants.id),
	device: jsonb('device'),
	...timestamps()
});

// One go at one item. A retest is a new attempt at the same item.
export const synAttempts = pgTable(
	'syn_attempts',
	{
		id: text('id').primaryKey(),
		participantId: text('participant_id')
			.notNull()
			.references(() => synParticipants.id),
		stimulusId: text('stimulus_id')
			.notNull()
			.references(() => synStimuli.id),
		retest: boolean('retest').notNull().default(false),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
		...timestamps()
	},
	(t) => [index().on(t.participantId, t.stimulusId)]
);

// Append-only. `client_id` is made on the device, so a resent answer is stored once.
// 'retract' undoes the answer named in `supersedes`. 'flag' marks the whole item (note "knows-song":
// she knows this song), with no range.
export const synAnswers = pgTable(
	'syn_answers',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		clientId: text('client_id').notNull().unique(),
		attemptId: text('attempt_id')
			.notNull()
			.references(() => synAttempts.id),
		participantId: text('participant_id')
			.notNull()
			.references(() => synParticipants.id),
		sessionId: text('session_id').notNull(),
		kind: text('kind', { enum: ['colour', 'none', 'note', 'flag', 'retract'] }).notNull(),
		// Grapheme range [start, end) in the stimulus body.
		start: integer('start'),
		end: integer('end'),
		colour: jsonb('colour'),
		note: text('note'),
		supersedes: text('supersedes'),
		// Device clock when she confirmed, its time zone, and ms since the item was shown and
		// since her previous answer (from performance.now(), immune to clock changes).
		answeredAt: timestamp('answered_at', { withTimezone: true }).notNull(),
		tz: text('tz'),
		shownMs: integer('shown_ms'),
		sincePrevMs: integer('since_prev_ms'),
		receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index().on(t.attemptId)]
);

// Reverse test: a random colour was shown and she wrote something that has it (or "nothing").
export const synReverse = pgTable(
	'syn_reverse',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		clientId: text('client_id').notNull().unique(),
		participantId: text('participant_id')
			.notNull()
			.references(() => synParticipants.id),
		sessionId: text('session_id').notNull(),
		colour: jsonb('colour').notNull(),
		text: text('text'),
		nothing: boolean('nothing').notNull().default(false),
		answeredAt: timestamp('answered_at', { withTimezone: true }).notNull(),
		tz: text('tz'),
		shownMs: integer('shown_ms'),
		receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index().on(t.participantId)]
);

// Each time she opens a result, so analysis can tell whether she had seen an item's colours
// before retesting it.
export const synResultViews = pgTable(
	'syn_result_views',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		participantId: text('participant_id')
			.notNull()
			.references(() => synParticipants.id),
		stimulusId: text('stimulus_id')
			.notNull()
			.references(() => synStimuli.id),
		...timestamps()
	},
	(t) => [index().on(t.participantId, t.stimulusId)]
);

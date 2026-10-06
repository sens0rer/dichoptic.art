import { sql, type SQL } from 'drizzle-orm';
import { db } from './db';
import type { Entry, Filters, Sort } from '../query';

export const PAGE_SIZE = 24;

// Sort position of an entry; also the cursor.
export interface Anchor {
	ca: string;
	lc: number;
	id: string;
}

const visibleCollectionImage = sql`ci.deleted_at IS NULL AND ci.status = 'approved' AND NOT ci.private`;
const normBy = (col: string) =>
	sql.raw(`lower(regexp_replace(btrim(${col}), '\\s+', ' ', 'g'))`);

interface Cond {
	image: SQL;
	collection: SQL;
}

// Every filter is expressed once for a standalone image (alias i) and once for a collection
// (alias c), where a collection matches on its own values or on any visible image inside it.
function conditions(f: Filters): Cond[] {
	const out: Cond[] = [];
	const inside = (body: SQL) =>
		sql`EXISTS (SELECT 1 FROM images ci WHERE ci.collection_id = c.id AND ${visibleCollectionImage} AND ${body})`;

	// Every word matches as a prefix, so "cotton" finds "Cottonwoods".
	const words = f.q.match(/[\p{L}\p{N}]+/gu);
	if (words) {
		const tsq = sql`to_tsquery('simple', ${words.map((w) => `${w}:*`).join(' & ')})`;
		out.push({
			image: sql`i.search @@ ${tsq}`,
			collection: sql`(c.search @@ ${tsq} OR ${inside(sql`ci.search @@ ${tsq}`)})`
		});
	}
	for (const col of ['dimension', 'medium', 'alteration', 'chromacy'] as const) {
		const v = f[col];
		if (!v) continue;
		const ident = sql.raw(col);
		out.push({
			image: sql`i.${ident}::text = ${v}`,
			collection: sql`(c.${ident}::text = ${v} OR ${inside(sql`ci.${ident}::text = ${v}`)})`
		});
	}
	if (f.chromacyType)
		out.push({
			image: sql`i.chromacy_type = ${f.chromacyType}`,
			collection: sql`(c.chromacy_type = ${f.chromacyType} OR ${inside(sql`ci.chromacy_type = ${f.chromacyType}`)})`
		});
	for (const tag of f.tags)
		out.push({
			image: sql`EXISTS (SELECT 1 FROM image_tags it JOIN tags t ON t.id = it.tag_id WHERE it.image_id = i.id AND t.name = ${tag})`,
			collection: sql`(EXISTS (SELECT 1 FROM collection_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.collection_id = c.id AND t.name = ${tag})
				OR ${inside(sql`EXISTS (SELECT 1 FROM image_tags it JOIN tags t ON t.id = it.tag_id WHERE it.image_id = ci.id AND t.name = ${tag})`)})`
		});
	if (f.by)
		out.push({
			image: sql`${normBy('i.submitted_by')} = ${f.by}`,
			collection: sql`${normBy('c.submitted_by')} = ${f.by}`
		});
	return out;
}

const and = (parts: SQL[]) => (parts.length ? sql.join(parts, sql` AND `) : sql`TRUE`);

// Rows strictly after (dir 'after') or before an anchor, in the order of `sort`.
function position(sort: Sort, a: Anchor, dir: 'after' | 'before'): SQL {
	const op = sql.raw(dir === 'after' ? '<' : '>');
	return sort === 'liked'
		? sql`(e.like_count, e.ca::timestamptz, e.id) ${op} (${a.lc}::int, ${a.ca}::timestamptz, ${a.id})`
		: sql`(e.ca::timestamptz, e.id) ${op} (${a.ca}::timestamptz, ${a.id})`;
}

function orderBy(sort: Sort, reverse: boolean): SQL {
	const d = sql.raw(reverse ? 'ASC' : 'DESC');
	return sort === 'liked'
		? sql`e.like_count ${d}, e.ca::timestamptz ${d}, e.id ${d}`
		: sql`e.ca::timestamptz ${d}, e.id ${d}`;
}

export async function listEntries(
	f: Filters,
	sort: Sort,
	opts: { after?: Anchor; before?: Anchor; limit?: number } = {}
): Promise<Entry[]> {
	const conds = conditions(f);
	const limit = opts.limit ?? PAGE_SIZE;
	const anchor = opts.after ?? opts.before;
	const rows = await db.execute(sql`
		WITH e AS (
			SELECT 'image'::text AS type, i.id, i.title, i.thumb_prefix AS "thumbPrefix",
				i.thumb_w AS "thumbW", i.thumb_h AS "thumbH", i.like_count, 1 AS count,
				i.submitted_by AS "submittedBy", i.credit_name AS "creditName", i.created_at::text AS ca
			FROM images i
			WHERE i.collection_id IS NULL AND i.deleted_at IS NULL AND i.status = 'approved' AND NOT i.private
				AND ${and(conds.map((c) => c.image))}
			UNION ALL
			SELECT 'collection', c.id, c.title, cov.thumb_prefix, cov.thumb_w, cov.thumb_h, c.like_count,
				cnt.n, c.submitted_by, c.credit_name, c.created_at::text
			FROM collections c
			JOIN LATERAL (
				SELECT ci.thumb_prefix, ci.thumb_w, ci.thumb_h FROM images ci
				WHERE ci.collection_id = c.id AND ${visibleCollectionImage}
				ORDER BY (ci.id = c.cover_image_id) DESC, ci.created_at, ci.id LIMIT 1
			) cov ON TRUE
			JOIN LATERAL (
				SELECT count(*)::int AS n FROM images ci WHERE ci.collection_id = c.id AND ${visibleCollectionImage}
			) cnt ON TRUE
			WHERE c.deleted_at IS NULL AND c.status = 'approved' AND NOT c.private
				AND ${and(conds.map((c) => c.collection))}
		)
		SELECT e.type, e.id, e.title, e."thumbPrefix", e."thumbW", e."thumbH", e.like_count AS "likeCount",
			e.count, e."submittedBy", e."creditName", e.ca
		FROM e
		WHERE ${anchor ? position(sort, anchor, opts.before ? 'before' : 'after') : sql`TRUE`}
		ORDER BY ${orderBy(sort, !!opts.before)}
		LIMIT ${limit}`);
	return [...rows] as unknown as Entry[];
}

export const anchorOf = (e: Entry): Anchor => ({ ca: e.ca, lc: e.likeCount, id: e.id });

export async function neighbours(f: Filters, sort: Sort, anchor: Anchor) {
	const [prev] = await listEntries(f, sort, { before: anchor, limit: 1 });
	const [next] = await listEntries(f, sort, { after: anchor, limit: 1 });
	return { prev: prev ?? null, next: next ?? null };
}

// First display name used for a normalised submitter name, for the /by/:name heading.
export async function displayName(by: string): Promise<string | null> {
	const rows = await db.execute<{ name: string }>(sql`
		SELECT name FROM (
			SELECT i.submitted_by AS name, i.created_at FROM images i
			WHERE i.deleted_at IS NULL AND i.status = 'approved' AND NOT i.private AND ${normBy('i.submitted_by')} = ${by}
			UNION ALL
			SELECT c.submitted_by, c.created_at FROM collections c
			WHERE c.deleted_at IS NULL AND c.status = 'approved' AND NOT c.private AND ${normBy('c.submitted_by')} = ${by}
		) n ORDER BY created_at LIMIT 1`);
	return rows[0]?.name ?? null;
}

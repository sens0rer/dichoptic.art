import { error } from '@sveltejs/kit';
import { config } from '#lib/server/config';
import { getCollection } from '#lib/server/content';
import { neighbours } from '#lib/server/feed';
import { isAdmin } from '#lib/server/admin';
import { currentOwner } from '#lib/server/owner';
import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { entryHref, parseQuery, toParams } from '#lib/query';

export async function load({ params, cookies, url }) {
	const owner = await currentOwner(cookies);
	const data = await getCollection(params.id, owner?.id, isAdmin(cookies));
	if (!data) error(404, 'Collection not found');
	const { collection } = data;
	const cover =
		data.images.find((i) => i.id === collection.coverImageId && i.status === 'approved') ??
		data.images.find((i) => i.status === 'approved') ??
		data.images[0];
	let prev: string | null = null;
	let next: string | null = null;
	let back = '/';
	if (data.live) {
		const { filters, sort } = parseQuery(url.searchParams);
		const ctx = toParams(filters, sort);
		const [row] = await db.execute<{ ca: string }>(
			sql`SELECT created_at::text AS ca FROM collections WHERE id = ${collection.id}`
		);
		const n = await neighbours(filters, sort, {
			ca: row.ca,
			lc: collection.likeCount,
			id: collection.id
		});
		prev = n.prev ? entryHref(n.prev, ctx) : null;
		next = n.next ? entryHref(n.next, ctx) : null;
		back = ctx.size ? `/?${ctx}` : '/';
	}
	return {
		prev,
		next,
		back,
		collection: {
			id: collection.id,
			title: collection.title,
			description: collection.description,
			credit: collection.credit,
			submittedBy: collection.submittedBy,
			author: collection.author,
			dimension: collection.dimension,
			medium: collection.medium,
			alteration: collection.alteration,
			chromacy: collection.chromacy,
			chromacyType: collection.chromacyType,
			filterInfo: collection.filterInfo,
			likeCount: collection.likeCount,
			status: collection.status,
			rejectReason: collection.rejectReason
		},
		cover: cover ? { thumbPrefix: cover.thumbPrefix } : null,
		images: data.images.map((i) => ({
			id: i.id,
			title: i.title,
			thumbPrefix: i.thumbPrefix,
			thumbW: i.thumbW,
			thumbH: i.thumbH,
			status: i.status,
			likeCount: i.likeCount
		})),
		tags: data.tags,
		isOwner: data.isOwner,
		isPrivate: data.isPrivate,
		live: data.live,
		liked: data.liked,
		publicUrl: config.publicUrl
	};
}

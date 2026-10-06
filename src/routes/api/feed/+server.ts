import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { anchorOf, listEntries } from '#lib/server/feed';
import { parseQuery } from '#lib/query';

const anchor = z.object({
	ca: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
	lc: z.number().int().min(0).max(2147483647),
	id: z.string().max(40)
});

export async function GET({ url }) {
	const { filters, sort } = parseQuery(url.searchParams);
	let after;
	try {
		const c = url.searchParams.get('cursor');
		if (c) after = anchor.parse(JSON.parse(Buffer.from(c, 'base64url').toString()));
	} catch {
		after = undefined;
	}
	const entries = await listEntries(filters, sort, { after });
	const last = entries.at(-1);
	return json({
		entries,
		cursor: entries.length >= 24 && last ? Buffer.from(JSON.stringify(anchorOf(last))).toString('base64url') : null
	});
}

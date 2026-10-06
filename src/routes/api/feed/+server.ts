import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { anchorOf, listEntries } from '#lib/server/feed';
import { parseQuery } from '#lib/query';

const anchor = z.object({ ca: z.string(), lc: z.number().int(), id: z.string() });

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

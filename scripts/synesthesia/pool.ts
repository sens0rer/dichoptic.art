// Shared by the import scripts: adds items to the pools. Items are content-addressed, so adding
// the same item twice is a no-op and nothing already answered ever changes.
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { synStimuli } from '../../src/lib/server/db/schema';
import { stimulusId } from '../../src/lib/synesthesia/stimulus';

export interface NewItem {
	category: string;
	unit: 'word' | 'char' | 'math';
	lang: string | null;
	title?: string | null;
	body: string;
	source: Record<string, unknown>;
}

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

export async function add(items: NewItem[]) {
	let added = 0;
	for (const item of items) {
		const row = { ...item, title: item.title ?? null };
		const res = await db
			.insert(synStimuli)
			.values({ id: stimulusId(row), ...row })
			.onConflictDoNothing()
			.returning({ id: synStimuli.id });
		added += res.length;
		const label = item.title ?? item.body.slice(0, 40).replace(/\s+/g, ' ');
		console.log(`${res.length ? 'added ' : 'exists'}  ${item.category}  ${item.lang ?? '-'}  ${label}`);
	}
	return added;
}

// Whether the pool already has an item from this source (say, a Wikipedia article), so a script
// whose cleanup changed does not add a second version of the same text.
export async function hasSource(category: string, source: Record<string, unknown>) {
	const rows = await client`SELECT 1 FROM syn_stimuli WHERE category = ${category} AND source @> ${JSON.stringify(source)}::jsonb LIMIT 1`;
	return rows.length > 0;
}

export const close = () => client.end();

// Deterministic shuffling and sampling, so a script makes the same items every time it runs.
export function rng(seed: number) {
	return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

export function shuffle<T>(xs: T[], rnd: () => number) {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Adds the opening paragraphs of Wikipedia articles to the "texts" pool.
//   npx tsx scripts/synesthesia/import-wikipedia.ts            (the starter set below)
//   npx tsx scripts/synesthesia/import-wikipedia.ts uk Title…   (more articles in one language)
// Items are content-addressed, so running it twice adds nothing twice.
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { synStimuli } from '../../src/lib/server/db/schema';
import { stimulusId } from '../../src/lib/synesthesia/stimulus';

const STARTER: Record<string, string[]> = {
	uk: ['Бджола медоносна', 'Полярне сяйво', 'Хліб', 'Карпати', 'Бандура', 'Вишиванка'],
	en: ['Western honey bee', 'Aurora', 'Bread', 'Lighthouse', 'Origami', 'Tide']
};

// Short enough to fit a screen or two: whole sentences up to about this many characters.
const MAX = 520;

function trim(text: string) {
	const first = text.split(/\n+/).find((p) => p.trim().length > 80) ?? text;
	const sentences = first.match(/[^.!?…]+[.!?…]+(\s|$)/gu) ?? [first];
	let out = '';
	for (const s of sentences) {
		if (out && (out + s).length > MAX) break;
		out += s;
	}
	// Wikipedia openings carry bracketed pronunciations and dates; they read badly as test text.
	return out.replace(/\s*\([^()]*\)/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchIntro(lang: string, title: string) {
	const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
	url.search = new URLSearchParams({
		action: 'query',
		prop: 'extracts',
		exintro: '1',
		explaintext: '1',
		redirects: '1',
		format: 'json',
		titles: title
	}).toString();
	const res = await fetch(url, { headers: { 'user-agent': 'dichoptic.art synesthesia tests (import script)' } });
	if (!res.ok) throw new Error(`${lang}:${title}: HTTP ${res.status}`);
	const data = await res.json();
	const page = Object.values(data.query.pages)[0] as { title: string; extract?: string; pageid?: number };
	if (!page.extract) throw new Error(`${lang}:${title}: no such article`);
	return { title: page.title, pageid: page.pageid, text: trim(page.extract) };
}

const [lang, ...titles] = process.argv.slice(2);
const wanted = lang ? { [lang]: titles } : STARTER;

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);
let added = 0;
for (const [l, list] of Object.entries(wanted))
	for (const t of list) {
		// Wikipedia rate-limits quick bursts.
		await new Promise((r) => setTimeout(r, 1500));
		try {
			const a = await fetchIntro(l, t);
			const row = {
				category: 'texts',
				unit: 'word' as const,
				lang: l,
				title: null,
				body: a.text,
				source: { from: 'wikipedia', lang: l, article: a.title, pageid: a.pageid }
			};
			const res = await db
				.insert(synStimuli)
				.values({ id: stimulusId(row), ...row })
				.onConflictDoNothing()
				.returning({ id: synStimuli.id });
			added += res.length;
			console.log(`${res.length ? 'added' : 'exists'}  ${l}  ${a.title}  (${a.text.length} chars)`);
		} catch (e) {
			console.warn(String(e));
		}
	}
await client.end();
console.log(`${added} new item(s)`);

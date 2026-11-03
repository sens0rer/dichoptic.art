// Adds the opening paragraphs of Wikipedia articles to a text pool.
//   npx tsx scripts/synesthesia/import-wikipedia.ts                          (every starter set below)
//   npx tsx scripts/synesthesia/import-wikipedia.ts <category> <lang> Title…  (more articles)
// Items are content-addressed, so running it twice adds nothing twice.
import { add, close, hasSource, pause, type NewItem } from './pool';

// Same subjects across languages where possible, so languages can be compared on similar content.
const STARTER: Record<string, Record<string, string[]>> = {
	texts: {
		uk: ['Бджола медоносна', 'Полярне сяйво', 'Хліб', 'Карпати', 'Бандура', 'Вишиванка'],
		en: ['Western honey bee', 'Aurora', 'Bread', 'Lighthouse', 'Origami', 'Tide']
	},
	// Specialist subjects, chosen for terms she is unlikely to know.
	terminology: {
		uk: ['Мітохондрія', 'Геральдика', 'Такелаж', 'Електроенцефалографія', 'Вексель'],
		en: ['Mitochondrion', 'Heraldry', 'Rigging', 'Electroencephalography', 'Bill of exchange']
	},
	similar: {
		la: ['Panis', 'Luna'],
		fr: ['Pain', 'Lune'],
		de: ['Brot', 'Mond'],
		be: ['Хлеб', 'Сонца'],
		pl: ['Chleb', 'Księżyc']
	},
	dissimilar: {
		ar: ['خبز', 'قمر'],
		ko: ['빵', '달'],
		ja: ['パン', '月'],
		zh: ['面包', '月球'],
		th: ['ขนมปัง', 'ดวงจันทร์'],
		he: ['לחם', 'הירח']
	}
};

// Short enough to fit a screen or two: whole sentences up to about this many characters.
const MAX = 520;

function trim(text: string) {
	const first = text.split(/\n+/).find((p) => p.trim().length > 60) ?? text;
	// Wikipedia openings carry bracketed pronunciations and dates; they read badly as test text.
	const clean = first.replace(/\s*[(（][^()（）]*[)）]/g, '').replace(/\s+/g, ' ').trim();
	// Sentence ends in the scripts used here, including 。！？ and the Arabic ؟.
	const sentences = clean.match(/[^.!?…。！？؟]+[.!?…。！？؟]+\s*/gu) ?? [clean];
	let out = '';
	for (const s of sentences) {
		if (out && (out + s).length > MAX) break;
		out += s;
	}
	out = out.trim() || clean;
	// Thai has no sentence punctuation: cut at the last space before the limit.
	if (out.length > MAX * 1.3) out = out.slice(0, out.lastIndexOf(' ', MAX) > 0 ? out.lastIndexOf(' ', MAX) : MAX);
	return out.trim();
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
	let res: Response;
	// Wikipedia answers 429 when asked too often; wait and try again, longer each time.
	for (let attempt = 0; ; attempt++) {
		res = await fetch(url, { headers: { 'user-agent': 'dichoptic.art synesthesia tests (import script)' } });
		if (res.status !== 429 || attempt === 5) break;
		const wait = Number(res.headers.get('retry-after')) * 1000 || 5000 * 2 ** attempt;
		console.log(`  rate-limited, waiting ${Math.round(wait / 1000)} s`);
		await pause(wait);
	}
	if (!res.ok) throw new Error(`${lang}:${title}: HTTP ${res.status}`);
	const data = await res.json();
	const page = Object.values(data.query.pages)[0] as { title: string; extract?: string; pageid?: number };
	if (!page.extract) throw new Error(`${lang}:${title}: no such article`);
	const text = trim(page.extract);
	// Disambiguation pages open with a line or two; they are not passages.
	if (text.length < 80) throw new Error(`${lang}:${title}: too short, probably a disambiguation page`);
	return { title: page.title, pageid: page.pageid, text };
}

const [category, lang, ...titles] = process.argv.slice(2);
const wanted = category ? { [category]: { [lang]: titles } } : STARTER;

let added = 0;
for (const [cat, langs] of Object.entries(wanted))
	for (const [l, list] of Object.entries(langs))
		for (const t of list) {
			// Wikipedia rate-limits quick bursts.
			await pause(1500);
			try {
				const a = await fetchIntro(l, t);
				const source = { from: 'wikipedia', lang: l, pageid: a.pageid };
				if (await hasSource(cat, source)) {
					console.log(`exists  ${cat}  ${l}  ${a.title}`);
					continue;
				}
				const tags = { genre: cat === 'terminology' ? 'encyclopedia (specialist)' : 'encyclopedia', theme: a.title, era: 'contemporary', form: 'prose' };
				const item: NewItem = { category: cat, unit: 'word', lang: l, body: a.text, source: { ...source, article: a.title, tags } };
				added += await add([item]);
			} catch (e) {
				console.warn(String(e));
			}
		}
await close();
console.log(`${added} new item(s)`);

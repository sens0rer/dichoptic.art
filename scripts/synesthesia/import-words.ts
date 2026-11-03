// Adds "separate words" items: 20 words each, without context, mixed evenly from four frequency
// bands (very common to rare), so every item has familiar and unusual words. Words are dictionary
// forms of nouns, verbs, adjectives and adverbs, with no names.
//
//   npx tsx scripts/synesthesia/import-words.ts --bruk <dir> --dic <file> [--count 10] [--seed 1]
//
// Ukrainian: the Ukrainian Brown Corpus (BRUK, github.com/brown-uk/corpus, CC BY-NC-SA 4.0), its
//   hand-checked tagged texts (data/disambig). Lemma frequencies; names are tagged "prop" and left out.
// English: OpenSubtitles frequencies (FrequencyWords by Hermit Dave, MIT), keeping only words that
//   are lowercase base forms in the Hunspell en_US dictionary (wooorm/dictionaries), which drops
//   names, fragments and inflected forms.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { add, close, rng, shuffle, type NewItem } from './pool';

const arg = (name: string, fallback?: string) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 ? process.argv[i + 1] : fallback;
};
const brukDir = arg('bruk');
const dicFile = arg('dic');
const count = Number(arg('count', '10'));
const seed = Number(arg('seed', '1'));
if (!brukDir || !dicFile) throw new Error('Usage: import-words.ts --bruk <data/disambig dir> --dic <en_US .dic file>');

// Rank bands: 1–1000, 1001–5000, 5001–12000, and rarer (the English list is about 19 000 words).
const BANDS = [1000, 5000, 12000, Infinity];
const PER_BAND = 5;

function ukrainian(): string[] {
	const counts = new Map<string, number>();
	const token = /<token value="[^"]*" lemma="([^"]*)" tags="([^"]*)"/g;
	for (const file of readdirSync(brukDir!)) {
		if (!file.endsWith('.xml')) continue;
		const xml = readFileSync(join(brukDir!, file), 'utf8');
		for (const [, lemma, tags] of xml.matchAll(token)) {
			if (!/^(noun|verb|adj|adv)(:|$)/.test(tags)) continue;
			if (/:(prop|abbr|bad|pron|alt|slang|rare)(:|$)/.test(tags)) continue;
			const w = lemma.replace(/'/g, '’');
			if (!/^[а-щьюяґєії’-]{2,}$/.test(w) || w.startsWith('-') || w.endsWith('-')) continue;
			counts.set(w, (counts.get(w) ?? 0) + 1);
		}
	}
	return [...counts].sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

async function english(): Promise<string[]> {
	const stems = new Set(
		readFileSync(dicFile!, 'utf8')
			.split('\n')
			.slice(1)
			.map((line) => line.split('/')[0].trim())
			.filter((w) => /^[a-z]{2,}$/.test(w))
	);
	const res = await fetch('https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt');
	if (!res.ok) throw new Error(`en: HTTP ${res.status}`);
	return (await res.text())
		.split('\n')
		.map((line) => line.split(' ')[0]?.trim())
		.filter((w) => w && stems.has(w));
}

const items: NewItem[] = [];
for (const [lang, words] of [
	['uk', ukrainian()],
	['en', await english()]
] as const) {
	const bands: string[][] = BANDS.map(() => []);
	words.forEach((w, rank) => bands[BANDS.findIndex((limit) => rank < limit)].push(w));
	console.log(`${lang}: ${words.length} words; bands ${bands.map((b) => b.length).join(' / ')}`);
	const rnd = rng(seed * 7919 + (lang === 'uk' ? 1 : 2));
	const shuffled = bands.map((b) => shuffle(b, rnd));
	for (let k = 0; k < count; k++) {
		const pick = shuffled.flatMap((b) => b.slice(k * PER_BAND, (k + 1) * PER_BAND));
		items.push({
			category: 'words',
			unit: 'word',
			lang,
			body: shuffle(pick, rnd).join('   '),
			source: { from: lang === 'uk' ? 'bruk' : 'frequencywords+hunspell', lang, seed, n: k }
		});
	}
}

const added = await add(items);
await close();
console.log(`${added} new item(s)`);

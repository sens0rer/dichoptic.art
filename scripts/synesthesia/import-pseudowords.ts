// Adds English pseudowords: pronounceable letter strings that are not words. 20 per item, five in
// each length band, so items match the separate-words items in shape.
//   npx tsx scripts/synesthesia/import-pseudowords.ts --dic <en_US .dic file> [--count 10] [--seed 1]
//
// Made the way UniPseudo makes them (New et al., 2023): a letter model learned from real words
// (which letter follows each pair of letters, and how often) writes new strings, and anything
// that is a real word is thrown away. Real words: the Hunspell en_US dictionary (wooorm/dictionaries)
// plus the 50 000 most frequent subtitle words (FrequencyWords, MIT), so inflected forms and
// common names are excluded too.
import { readFileSync } from 'node:fs';
import { add, close, rng, shuffle, type NewItem } from './pool';

const arg = (name: string, fallback?: string) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 ? process.argv[i + 1] : fallback;
};
const dicFile = arg('dic');
const count = Number(arg('count', '10'));
const seed = Number(arg('seed', '1'));
if (!dicFile) throw new Error('Usage: import-pseudowords.ts --dic <en_US .dic file>');

const base = readFileSync(dicFile, 'utf8')
	.split('\n')
	.slice(1)
	.map((l) => l.split('/')[0].trim())
	.filter((w) => /^[a-z]{2,}$/.test(w));
const res = await fetch('https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt');
if (!res.ok) throw new Error(`frequency list: HTTP ${res.status}`);
const frequent = (await res.text()).split('\n').map((l) => l.split(' ')[0]?.trim()).filter(Boolean);
const real = new Set([...base, ...frequent]);

// Letter model: for each two-letter context (with ^ for a word start), the letters that follow
// and how often; $ ends the word.
const model = new Map<string, Map<string, number>>();
for (const w of base) {
	const s = `^^${w}$`;
	for (let i = 2; i < s.length; i++) {
		const ctx = s.slice(i - 2, i);
		const next = model.get(ctx) ?? new Map<string, number>();
		next.set(s[i], (next.get(s[i]) ?? 0) + 1);
		model.set(ctx, next);
	}
}

const rnd = rng(seed * 104729 + 7);
function pick(options: Map<string, number>) {
	let total = 0;
	for (const n of options.values()) total += n;
	let r = rnd() * total;
	for (const [c, n] of options) if ((r -= n) < 0) return c;
	return '$';
}

function generate(): string | null {
	let w = '^^';
	while (w.length < 16) {
		const c = pick(model.get(w.slice(-2))!);
		if (c === '$') break;
		w += c;
	}
	return w.length > 2 && w.length < 16 ? w.slice(2) : null;
}

// Consonant clusters by position (start, middle, end of the word) and how many real words have
// them there. A pseudoword whose clusters are rare in that position ("stf-", "md-") reads as
// unpronounceable, so those are refused.
const clusters = (w: string) => {
	const parts = w.match(/[^aeiouy]+|[aeiouy]+/g) ?? [];
	return parts
		.map((p, i) => ({ p, at: i === 0 ? 'start' : i === parts.length - 1 ? 'end' : 'mid' }))
		.filter(({ p }) => !/[aeiouy]/.test(p));
};
const clusterCount = new Map<string, number>();
for (const w of base)
	if (/[aeiouy]/.test(w)) for (const { p, at } of clusters(w)) clusterCount.set(`${at}:${p}`, (clusterCount.get(`${at}:${p}`) ?? 0) + 1);
const pronounceable = (w: string) => clusters(w).every(({ p, at }) => (clusterCount.get(`${at}:${p}`) ?? 0) >= 30);

// Sound-alikes of real words ("brane" for "brain"). Without a pronunciation dictionary for made-up
// strings this is approximate: try the common English spellings of the same sound, one swap at
// a time, plus a dropped or added final e and single for doubled letters, and refuse the string
// if any variant is a real word.
const SAME_SOUND = [
	['ane', 'ain'], ['ade', 'aid'], ['ate', 'ait'], ['ale', 'ail'], ['ame', 'aim'], ['ai', 'ay'],
	['ee', 'ea'], ['ee', 'ie'], ['ea', 'ie'], ['ete', 'eat'], ['eme', 'eam'], ['ene', 'een'],
	['ight', 'ite'], ['ime', 'yme'], ['i', 'y'], ['oa', 'o'], ['ote', 'oat'], ['one', 'own'], ['oe', 'ow'],
	['ow', 'ou'], ['oo', 'ue'], ['oo', 'ew'], ['ew', 'ue'], ['ur', 'er'], ['ur', 'ir'], ['er', 'ir'], ['or', 'oar'],
	['ea', 'e'], ['gu', 'g'], ['ou', 'u'], ['ough', 'uff'], ['ough', 'o'], ['ough', 'ow'],
	['ph', 'f'], ['ck', 'k'], ['c', 'k'], ['s', 'z'], ['s', 'c'], ['x', 'cks'], ['qu', 'kw'], ['wr', 'r'], ['kn', 'n'], ['gh', '']
];
function soundsLikeReal(w: string) {
	const variants = new Set<string>([w.replace(/e$/, ''), w + 'e', w.replace(/(.)\1/g, '$1')]);
	for (const [a, b] of SAME_SOUND)
		for (const [from, to] of [
			[a, b],
			[b, a]
		]) {
			if (!from) continue;
			for (let i = w.indexOf(from); i >= 0; i = w.indexOf(from, i + 1)) variants.add(w.slice(0, i) + to + w.slice(i + from.length));
		}
	variants.delete(w);
	return [...variants].some((v) => isReal(v));
}

// The dictionary lists base forms; a real word plus a common ending ("pined") is real too.
function isReal(w: string) {
	if (real.has(w)) return true;
	const stems = [
		w.replace(/(s|es)$/, ''),
		w.replace(/(ed|d)$/, ''),
		w.replace(/ing$/, ''),
		w.replace(/ing$/, 'e'),
		w.replace(/(er|est|ly)$/, ''),
		w.replace(/(er|est)$/, 'e'),
		w.replace(/ied$/, 'y'),
		w.replace(/ies$/, 'y'),
		w.replace(/([^aeiou])\1(ed|ing|er|est)$/, '$1')
	];
	return stems.some((s) => s !== w && s.length > 1 && real.has(s));
}

// Letter strings close enough to rude words that they read as them.
const RUDE = /fuck|shit|cunt|dick|cock|piss|slut|whore|nigg|fag|rape|porn|tits|bitch|bastard|wank|twat/;
const ok = (w: string) =>
	/[aeiouy]/.test(w) && !/(.)\1\1/.test(w) && !isReal(w) && !RUDE.test(w) && pronounceable(w) && !soundsLikeReal(w);

// Length bands, shortest to longest.
const BANDS = [
	[3, 4],
	[5, 6],
	[7, 8],
	[9, 11]
];
const PER_BAND = 5;
const pools = BANDS.map(() => new Set<string>());
for (let tries = 0; tries < 2_000_000 && pools.some((p) => p.size < count * PER_BAND); tries++) {
	const w = generate();
	if (!w || !ok(w)) continue;
	const b = BANDS.findIndex(([lo, hi]) => w.length >= lo && w.length <= hi);
	if (b >= 0 && pools[b].size < count * PER_BAND) pools[b].add(w);
}

const lists = pools.map((p) => [...p]);
const items: NewItem[] = [];
for (let k = 0; k < count; k++) {
	const words = lists.flatMap((l) => l.slice(k * PER_BAND, (k + 1) * PER_BAND));
	items.push({
		category: 'pseudowords',
		unit: 'word',
		lang: 'en',
		body: shuffle(words, rnd).join('   '),
		source: { from: 'generated', what: 'english pseudowords', method: 'letter trigrams over hunspell en_US', seed, n: k }
	});
}

const added = await add(items);
await close();
console.log(`${added} new item(s)`);

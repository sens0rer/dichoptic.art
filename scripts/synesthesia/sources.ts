// Fetching and cutting passages from Project Gutenberg and MediaWiki sites (Wikisource, Wikinews,
// Wikibooks), shared by the text and song imports.
import { pause } from './pool';

export const UA = { 'user-agent': 'dichoptic.art synesthesia tests (import script)' };

export type Form = 'prose' | 'verse' | 'dialogue';
export interface Tags {
	genre: string;
	theme: string;
	era: string;
	form: Form;
}

const MAX_PROSE = 560;
const MAX_VERSE = 420;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#160': ' ' };
const decode = (s: string) =>
	s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
		e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m)
	);

export function htmlToText(html: string) {
	return decode(
		html
			// footnote markers, tables, edit links, navigation boxes
			.replace(/<(script|style|sup|table)\b[\s\S]*?<\/\1>/gi, '')
			.replace(/<span class="mw-editsection[\s\S]*?<\/span>\s*<\/span>/gi, '')
			// (a <br> followed by a newline in the page source would otherwise make two breaks)
			.replace(/<br\s*\/?>\s*/gi, '\n')
			.replace(/<\/(p|div|li|dd|dt|h\d|tr|blockquote)>/gi, '\n')
			.replace(/<li\b[^>]*>/gi, '\n')
			.replace(/<[^>]+>/g, '')
	)
		.replace(/[ \t ]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

// Finds a phrase ignoring punctuation, spacing and case, so "Tyger Tyger, burning bright" matches
// "Tyger! Tyger! burning bright". Returns the index in the original text.
export function find(text: string, phrase: string) {
	const keep: number[] = [];
	let letters = '';
	for (let i = 0; i < text.length; i++)
		if (/[\p{L}\p{N}]/u.test(text[i])) {
			letters += text[i].toLowerCase();
			keep.push(i);
		}
	const want = [...phrase].filter((c) => /[\p{L}\p{N}]/u.test(c)).join('').toLowerCase();
	// The words must begin a line (after a speaker's name or verse number at most): a page that
	// only quotes them mid-sentence, like a dictionary entry or a commentary, is not the text.
	for (let at = letters.indexOf(want); at >= 0; at = letters.indexOf(want, at + 1)) {
		const i = keep[at];
		const lineStart = text.lastIndexOf('\n', i) + 1;
		const before = text.slice(lineStart, i).replace(/[^\p{L}]/gu, '');
		if (before.length <= 12 && before === before.toUpperCase()) return lineStart;
	}
	return -1;
}

// A passage from `from`: whole sentences (prose, dialogue) or whole lines, ending at a stanza
// break when there is one (verse), up to about the size of a screen.
export function passage(text: string, from: number, form: Form) {
	let rest = text.slice(from);
	if (form === 'verse') {
		// Some pages set every verse line as its own paragraph: one blank line between lines, two
		// between stanzas. Close up the single ones.
		const head = rest.slice(0, 2000).split('\n');
		if (head.filter((l) => l.trim() === '').length > head.length * 0.35)
			rest = rest.replace(/\n\n(?!\n)/g, '\n').replace(/\n{2,}/g, '\n\n');
		const lines = rest.split('\n');
		const out: string[] = [];
		let size = 0;
		for (const line of lines) {
			if (size > MAX_VERSE * 0.6 && line.trim() === '') break;
			if (size + line.length > MAX_VERSE && out.length) break;
			out.push(line);
			size += line.length + 1;
		}
		return out.join('\n').trim();
	}
	// Prose and dialogue: keep paragraph breaks, cut after the last whole sentence that fits.
	const chunk = rest.slice(0, MAX_PROSE * 1.4);
	let cut = -1;
	for (const m of chunk.matchAll(/[.!?…»"”](\s|$)/g)) {
		const end = (m.index ?? 0) + 1;
		if (end > MAX_PROSE) break;
		cut = end;
	}
	return (cut > 80 ? chunk.slice(0, cut) : chunk.slice(0, MAX_PROSE)).trim();
}

// Without known opening words: the first paragraph long enough to be text rather than a heading.
export const firstParagraph = (text: string) => {
	const m = text.match(/(^|\n)([^\n]{150,})/);
	return m ? (m.index ?? 0) + m[1].length : 0;
};

// ---- sources ----

// Without known opening words for a poem or song: the first of two consecutive lines that look
// like verse (short, not headings).
// Blank lines between them do not matter (some pages put every line in its own paragraph).
export const firstVerse = (text: string) => {
	const lines: { at: number; text: string }[] = [];
	let pos = 0;
	for (const l of text.split('\n')) {
		if (l.trim()) lines.push({ at: pos, text: l });
		pos += l.length + 1;
	}
	const verse = (l: string) => l.length >= 12 && l.length <= 90 && /\p{Ll}/u.test(l);
	for (let i = 0; i < lines.length - 1; i++) if (verse(lines[i].text) && verse(lines[i + 1].text)) return lines[i].at;
	return -1;
};

export async function gutenberg(id: number) {
	const res = await fetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, { headers: UA });
	if (!res.ok) throw new Error(`Gutenberg ${id}: HTTP ${res.status}`);
	const raw = (await res.text()).replace(/\r/g, '');
	const body = raw.split(/\*\*\* ?START OF[^\n]*\n/)[1]?.split(/\*\*\* ?END OF/)[0] ?? raw;
	return body;
}
// Gutenberg wraps lines at about 70 characters; join them back into paragraphs.
export const unwrap = (s: string) => s.replace(/([^\n])\n(?!\n)/g, '$1 ').replace(/\n{2,}/g, '\n').replace(/ {2,}/g, ' ');

export async function api(host: string, params: Record<string, string>) {
	const url = new URL(`https://${host}/w/api.php`);
	url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString();
	for (let attempt = 0; ; attempt++) {
		const res = await fetch(url, { headers: UA });
		if (res.status === 429 && attempt < 5) {
			await pause(Number(res.headers.get('retry-after')) * 1000 || 5000 * 2 ** attempt);
			continue;
		}
		if (!res.ok) throw new Error(`${host}: HTTP ${res.status}`);
		const data = await res.json();
		// MediaWiki also rate-limits with a JSON error rather than a 429.
		if (data.error?.code === 'ratelimited' && attempt < 5) {
			await pause(5000 * 2 ** attempt);
			continue;
		}
		return data;
	}
}

// A page's text. Where Wikisource marks verse as poem blocks, those are taken alone: they are
// the work itself, while the rest may be version notes (sometimes wrapped around the poem in a
// table, which would otherwise be dropped with the other tables).
export const pageText = async (host: string, title: string) => {
	const data = await api(host, { action: 'parse', page: title, prop: 'text', redirects: '1' });
	const html: string = data.parse?.text ?? '';
	const poems = [...html.matchAll(/<div class="poem"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => m[1]);
	return htmlToText(poems.length ? poems.join('<br><br>') : html);
};

// The first line spoken in a play: a speaker's name in capitals, then the words.
export const firstSpeech = (text: string) => {
	const m = text.match(/(^|\n)(\p{Lu}[\p{Lu}'’ -]{2,}[.:]?[ \n]+\p{L}[^\n]{20,})/u);
	return m ? (m.index ?? 0) + m[1].length : -1;
};

// The first page that contains the opening words, found by searching for the words themselves (a
// title search tends to land on an index page). Without opening words: the first result of a
// title search, starting at its first spoken line for drama.
// `page` names the exact page when the search cannot find it (works split into chapters).
export async function wikisource(lang: string, search: string, start: string | null, form: Form, page?: string) {
	const host = `${lang}.wikisource.org`;
	const query = start ? `"${start}"` : `intitle:${search}`;
	const hits = page
		? [{ title: page }]
		: ((await api(host, { action: 'query', list: 'search', srsearch: query, srlimit: '10' })).query.search as { title: string }[]);
	for (const hit of hits) {
		await pause(800);
		let text = await pageText(host, hit.title);
		// A short page naming a work is usually a list of its versions: follow the first link that
		// names the same work.
		if (page && text.length < 250) {
			const links = ((await api(host, { action: 'parse', page: hit.title, prop: 'links' })).parse?.links ?? []) as { title: string; ns: number; exists: boolean }[];
			const word = hit.title.split(/[ ,.…]+/)[0].toLowerCase();
			const version = links.find((l) => l.ns === 0 && l.exists && l.title.toLowerCase().includes(word) && l.title !== hit.title);
			if (version) {
				await pause(800);
				text = await pageText(host, version.title);
				hit.title = version.title;
			}
		}
		const opening = () => (form === 'dialogue' ? firstSpeech(text) : form === 'verse' ? firstVerse(text) : firstParagraph(text));
		let at = start ? find(text, start) : opening();
		// A page named outright is the work itself: if its wording differs from the opening words
		// given (older spelling, other punctuation), start at its first lines instead.
		if (at < 0 && page) at = opening();
		if (at >= 0 && text.length > 200) return { title: hit.title, text, at };
	}
	return null;
}

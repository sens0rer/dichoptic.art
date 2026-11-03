// Lyrics search for "Your songs", through LRCLIB (lrclib.net: free, community-run, no key). The
// browser asks our server, which identifies the site to LRCLIB as it asks.

const UA = 'dichoptic.art colour tests (https://dichoptic.art)';

export interface Song {
	id: number;
	artist: string;
	track: string;
	album: string | null;
	lines: string[];
}

export class LyricsBusy extends Error {}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// LRCLIB is often busy (503); retry with growing pauses before giving up.
async function lrclib(q: string): Promise<Song[]> {
	const url = `https://lrclib.net/api/search?${new URLSearchParams({ q })}`;
	for (let attempt = 0; ; attempt++) {
		const res = await fetch(url, { headers: { 'user-agent': UA } });
		if (res.status === 503 && attempt < 3) {
			await pause(1000 * 2 ** attempt);
			continue;
		}
		if (res.status === 503) throw new LyricsBusy('LRCLIB is busy');
		if (!res.ok) throw new Error(`LRCLIB: HTTP ${res.status}`);
		const rows = (await res.json()) as {
			id: number;
			artistName: string;
			trackName: string;
			albumName: string | null;
			plainLyrics: string | null;
			instrumental: boolean;
		}[];
		return rows
			.filter((r) => r.plainLyrics && !r.instrumental)
			.map((r) => ({
				id: r.id,
				artist: r.artistName,
				track: r.trackName,
				album: r.albumName,
				lines: r.plainLyrics!.split(/\r?\n/).map((l) => l.trim())
			}));
	}
}

// Ukrainian national transliteration (2010), enough for searching: LRCLIB often lists Ukrainian
// artists and titles in Latin letters, and a Cyrillic search can miss them.
const TRANSLIT: Record<string, string> = {
	а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i',
	к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
	ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', '’': '', "'": ''
};
export const transliterate = (s: string) =>
	[...s].map((c) => {
		const lower = c.toLowerCase();
		const t = TRANSLIT[lower];
		if (t === undefined) return c;
		return c === lower ? t : t.charAt(0).toUpperCase() + t.slice(1);
	}).join('');

const cyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

export async function searchLyrics(q: string): Promise<Song[]> {
	const found = await lrclib(q);
	if (cyrillic(q) && found.length < 5) {
		const seen = new Set(found.map((s) => s.id));
		for (const s of await lrclib(transliterate(q))) if (!seen.has(s.id)) found.push(s);
	}
	return found.slice(0, 12);
}

// The excerpt's language, for the page's lang attribute: Cyrillic means Ukrainian here.
export const guessLang = (text: string) => {
	const letters = text.match(/\p{L}/gu) ?? [];
	const cyr = letters.filter((c) => cyrillic(c)).length;
	return cyr > letters.length / 2 ? 'uk' : 'en';
};

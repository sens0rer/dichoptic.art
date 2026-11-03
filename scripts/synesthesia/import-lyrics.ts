// Adds the song set: one Ukrainian and one English song for each kind of song, so both languages
// cover the same moods. Words only, a verse or two each; public-domain texts from Wikisource.
//   npx tsx scripts/synesthesia/import-lyrics.ts
// Songs are found by their opening words (which must begin a line, so a page merely quoting them
// is skipped). A song not found is reported and left out; run again later or add its page.
import { add, close, hasSource, type NewItem } from './pool';
import { find, gutenberg, passage, wikisource } from './sources';

interface Song {
	kind: string;
	lang: 'uk' | 'en';
	title: string;
	// Opening words; null to start at the first lines that look like verse.
	start: string | null;
	// The exact Wikisource page, when a search cannot find it.
	page?: string;
	// A Project Gutenberg book instead of Wikisource.
	book?: number;
}

// Three English songs differ from the first list, which English Wikisource does not have in
// usable form: Rock-a-bye Baby (for Hush, Little Baby), Greensleeves (for The Water Is Wide) and
// Blow the Man Down (for Drunken Sailor), each of the same kind.
const SONGS: Song[] = [
	{ kind: 'lullaby', lang: 'uk', title: 'Ой ходить сон коло вікон', start: 'Ой ходить сон коло вікон' },
	{ kind: 'lullaby', lang: 'en', title: 'Rock-a-bye Baby', page: 'Rock-a-bye Baby', start: 'Rock-a-bye baby' },
	{ kind: 'carol', lang: 'uk', title: 'Щедрик', page: 'Щедрик, щедрик, щедрівочка', start: 'Щедрик, щедрик' },
	{ kind: 'carol', lang: 'en', title: 'God Rest Ye Merry, Gentlemen', start: 'God rest ye merry, gentlemen' },
	{ kind: 'love song', lang: 'uk', title: 'Ніч яка місячна', page: 'Струни/Том 1/Виклик', start: 'Ніч яка місячна' },
	{ kind: 'love song', lang: 'en', title: 'A Red, Red Rose', book: 1279, start: 'my Luve' },
	{ kind: 'lament', lang: 'uk', title: 'Реве та стогне Дніпр широкий', start: 'Реве та стогне Дніпр широкий' },
	{ kind: 'lament', lang: 'en', title: 'Greensleeves', page: 'Greensleeves', start: 'Alas, my love' },
	{ kind: 'marching', lang: 'uk', title: 'Ой у лузі червона калина', start: 'Ой у лузі червона калина' },
	{ kind: 'marching', lang: 'en', title: 'When Johnny Comes Marching Home', start: 'When Johnny comes marching home' },
	{ kind: 'work song', lang: 'uk', title: 'Розпрягайте, хлопці, коні', start: 'Розпрягайте, хлопці, коні' },
	{ kind: 'work song', lang: 'en', title: 'Blow the Man Down', page: 'Blow the Man Down', start: null },
	{ kind: "children's song", lang: 'uk', title: 'Танцювала риба з раком', start: 'Танцювала риба з раком' },
	{ kind: "children's song", lang: 'en', title: 'Twinkle, Twinkle, Little Star', start: 'Twinkle, twinkle, little star' },
	{ kind: 'hymn', lang: 'uk', title: 'Боже великий, єдиний', start: 'Боже великий, єдиний' },
	{ kind: 'hymn', lang: 'en', title: 'Amazing Grace', start: 'Amazing grace' },
	{ kind: 'comic', lang: 'uk', title: 'Ой ти, дівчино, з горіха зерня', page: 'Ой ти, дівчино, з горіха зерня…', start: 'Ой ти, дівчино' },
	{ kind: 'comic', lang: 'en', title: 'Oh My Darling, Clementine', page: 'Oh My Darling, Clementine', start: 'In a cavern' }
];

async function fromGutenberg(book: number, start: string) {
	const text = (await gutenberg(book)).replace(/\r/g, '');
	const at = find(text, start);
	return at < 0 ? null : { title: `gutenberg:${book}`, text, at };
}

let added = 0;
const missing: string[] = [];
for (const s of SONGS) {
	try {
		const found = s.book && s.start ? await fromGutenberg(s.book, s.start) : await wikisource(s.lang, s.title, s.start, 'verse', s.page);
		if (!found) {
			missing.push(`${s.lang} ${s.title}`);
			continue;
		}
		const item: NewItem = {
			category: 'lyrics',
			unit: 'word',
			lang: s.lang,
			title: s.title,
			body: passage(found.text, found.at, 'verse'),
			source: { from: 'wikisource', lang: s.lang, page: found.title, song: s.title, tags: { genre: 'song', theme: s.kind, era: 'traditional', form: 'verse' } }
		};
		if (await hasSource('lyrics', { song: s.title, lang: s.lang })) {
			console.log(`exists  ${s.lang}  ${s.title}`);
			continue;
		}
		added += await add([item]);
	} catch (err) {
		missing.push(`${s.lang} ${s.title} (${String(err)})`);
	}
}
await close();
console.log(`${added} new item(s)`);
if (missing.length) console.log(`Not found:\n  ${missing.join('\n  ')}`);

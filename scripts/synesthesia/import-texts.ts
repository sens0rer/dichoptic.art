// Adds varied passages to the "texts" pool, so it is not only encyclopaedia openings: fiction,
// poetry, drama dialogue, folk tales, archaic and religious text, essays, official texts, news and
// instructions, in Ukrainian and English. Each item is tagged with genre, theme, era and form, so
// later additions can be steered to keep the pool varied.
//   npx tsx scripts/synesthesia/import-texts.ts
//
// Sources: Project Gutenberg (English classics, by book id), Wikisource (Ukrainian classics,
// found by search), Wikinews (news), Wikibooks (recipes). Passages are found by their opening
// words where known, otherwise the first long paragraph is used.
import { add, close, hasSource, pause, type NewItem } from './pool';
import { api, find, firstParagraph, gutenberg, pageText, passage, unwrap, wikisource, type Tags } from './sources';

// ---- what to import ----

const ENGLISH: (Tags & { book: number; start: string; title: string })[] = [
	{ book: 1342, title: 'Pride and Prejudice (Austen)', start: 'It is a truth universally acknowledged', genre: 'novel', theme: 'marriage, society', era: '19th century', form: 'prose' },
	{ book: 46, title: 'A Christmas Carol (Dickens)', start: 'Marley was dead: to begin with', genre: 'novel', theme: 'death, winter', era: '19th century', form: 'prose' },
	{ book: 2701, title: 'Moby-Dick (Melville)', start: 'Call me Ishmael', genre: 'novel', theme: 'sea, restlessness', era: '19th century', form: 'prose' },
	{ book: 11, title: "Alice's Adventures in Wonderland (Carroll)", start: 'Alice was beginning to get very tired', genre: "children's story", theme: 'fantasy, boredom', era: '19th century', form: 'prose' },
	{ book: 844, title: 'The Importance of Being Earnest (Wilde)', start: 'Did you hear what I was playing, Lane', genre: 'drama', theme: 'comedy, manners', era: '19th century', form: 'dialogue' },
	{ book: 10, title: 'Genesis, King James Bible', start: 'In the beginning God created the heaven and the earth', genre: 'religious', theme: 'creation', era: '17th century (archaic)', form: 'prose' },
	{ book: 205, title: 'Walden (Thoreau)', start: 'When I wrote the following pages', genre: 'essay', theme: 'solitude, nature', era: '19th century', form: 'prose' },
	{ book: 5, title: 'Constitution of the United States', start: 'We the People of the United States', genre: 'legal', theme: 'state', era: '18th century', form: 'prose' },
	{ book: 12242, title: 'Emily Dickinson', start: 'Because I could not stop for Death', genre: 'poetry', theme: 'death', era: '19th century', form: 'verse' },
	{ book: 1934, title: 'Songs of Innocence and of Experience (Blake)', start: 'Tiger tiger burning bright', genre: 'poetry', theme: 'nature, awe', era: '18th century', form: 'verse' }
];

const UKRAINIAN: (Tags & { search: string; start: string | null; page?: string })[] = [
	{ search: 'Енеїда Котляревський', start: 'Еней був парубок моторний', genre: 'poetry', theme: 'comedy, adventure', era: '18th century (archaic)', form: 'verse' },
	{ search: 'Заповіт Шевченко', start: 'Як умру, то поховайте', genre: 'poetry', theme: 'homeland, death', era: '19th century', form: 'verse' },
	{ search: 'Садок вишневий коло хати', page: 'Садок вишневий коло хати', start: 'Садок вишневий коло хати', genre: 'poetry', theme: 'evening, family', era: '19th century', form: 'verse' },
	{ search: 'Contra spem spero Леся Українка', start: 'Гетьте, думи, ви хмари осінні', genre: 'poetry', theme: 'hope, defiance', era: '19th century', form: 'verse' },
	{ search: 'Каменярі Франко', start: 'Я бачив дивний сон', genre: 'poetry', theme: 'labour, struggle', era: '19th century', form: 'verse' },
	{ search: 'Кайдашева сім’я Нечуй-Левицький', page: 'Кайдашева сімя̀/I', start: null, genre: 'novel', theme: 'village, landscape', era: '19th century', form: 'prose' },
	{ search: 'Рукавичка казка', page: 'Рукавичка (казка)', start: 'Ішов дід лісом', genre: 'folk tale', theme: 'animals', era: 'folk', form: 'prose' },
	{ search: 'Лісова пісня', page: 'Лісова пісня', start: 'Старезний, густий, предковічний ліс', genre: 'drama', theme: 'nature, love', era: '20th century', form: 'prose' },
	{ search: 'Маруся Квітка-Основ’яненко', start: null, genre: 'novella', theme: 'love, village', era: '19th century', form: 'prose' },
	{ search: 'Конституція України', start: 'Україна є суверенна і незалежна', genre: 'legal', theme: 'state', era: 'contemporary', form: 'prose' }
];

async function news(lang: 'en' | 'uk', count: number): Promise<NewItem[]> {
	const host = `${lang}.wikinews.org`;
	const category = lang === 'en' ? 'Category:Published' : 'Категорія:Опубліковані';
	const pages = (await api(host, { action: 'query', list: 'categorymembers', cmtitle: category, cmsort: 'timestamp', cmdir: 'desc', cmlimit: String(count * 3) })).query
		.categorymembers as { title: string; pageid: number }[];
	const out: NewItem[] = [];
	for (const p of pages) {
		if (out.length >= count) break;
		await pause(800);
		const text = await pageText(host, p.title);
		const at = firstParagraph(text);
		const body = passage(text, at, 'prose');
		if (body.length < 200) continue;
		out.push({ category: 'texts', unit: 'word', lang, body, source: { from: 'wikinews', lang, article: p.title, pageid: p.pageid, tags: { genre: 'news', theme: 'current events', era: 'contemporary', form: 'prose' } } });
	}
	return out;
}

async function recipe(lang: 'en' | 'uk', search: string): Promise<NewItem | null> {
	const host = `${lang}.wikibooks.org`;
	// English recipes live in the Cookbook namespace (102), which a default search leaves out.
	const ns = lang === 'en' ? '102' : '0';
	const hits = (await api(host, { action: 'query', list: 'search', srsearch: search, srnamespace: ns, srlimit: '8' })).query.search as { title: string }[];
	for (const hit of hits) {
		// English Wikibooks has recipes only under Cookbook:; other books also mention cooking.
		if (lang === 'en' && !hit.title.startsWith('Cookbook:')) continue;
		await pause(800);
		const text = await pageText(host, hit.title);
		const at = find(text, lang === 'en' ? 'Procedure' : 'Приготування');
		if (at < 0) continue;
		const body = passage(text.slice(at).replace(/^[^\n]*\n/, ''), 0, 'prose');
		if (body.length < 150) continue;
		return { category: 'texts', unit: 'word', lang, body, source: { from: 'wikibooks', lang, page: hit.title, tags: { genre: 'instructions', theme: 'cooking', era: 'contemporary', form: 'prose' } } };
	}
	console.warn(`${lang} recipe: nothing usable for "${search}"`);
	return null;
}

let added = 0;
const save = async (item: NewItem) => {
	if (await hasSource('texts', item.source)) return console.log(`exists  ${item.lang}  ${JSON.stringify(item.source).slice(0, 60)}`);
	added += await add([item]);
};

for (const e of ENGLISH) {
	try {
		const raw = await gutenberg(e.book);
		const text = e.form === 'verse' ? raw.replace(/\r/g, '') : unwrap(raw);
		const at = find(text, e.start);
		if (at < 0) {
			console.warn(`not found: ${e.title}`);
			continue;
		}
		const { book, title, start, ...tags } = e;
		await save({ category: 'texts', unit: 'word', lang: 'en', body: passage(text, at, e.form).replace(/\b\d+:\d+ /g, ''), source: { from: 'gutenberg', book, work: title, tags } });
	} catch (err) {
		console.warn(String(err));
	}
}

for (const u of UKRAINIAN) {
	try {
		const found = await wikisource('uk', u.search, u.start, u.form, u.page);
		if (!found) {
			console.warn(`not found: ${u.search}`);
			continue;
		}
		const { search, start, page, ...tags } = u;
		await save({ category: 'texts', unit: 'word', lang: 'uk', body: passage(found.text, found.at, u.form), source: { from: 'wikisource', page: found.title, tags } });
	} catch (err) {
		console.warn(String(err));
	}
}

for (const lang of ['en', 'uk'] as const) {
	try {
		for (const item of await news(lang, 2)) await save(item);
		// Ukrainian Wikibooks has no proper recipes; that one is written for the tests (below).
		if (lang === 'en') {
			const r = await recipe(lang, 'pancakes');
			if (r) await save(r);
		}
	} catch (err) {
		console.warn(String(err));
	}
}

// Written for the tests, where no suitable source exists (Ukrainian instructions).
await save({
	category: 'texts',
	unit: 'word',
	lang: 'uk',
	body: 'Буряк і моркву натріть на великій тертці, цибулю дрібно наріжте. Обсмажте їх на олії хвилин десять, додайте ложку томатної пасти. Тим часом поставте варитися бульйон і киньте туди нарізану картоплю та капусту. Коли картопля стане м’якою, перекладіть у каструлю засмажку, посоліть, покладіть лаврове листя й часник. Дайте борщу закипіти, а потім постояти під кришкою пів години. Подавайте зі сметаною.',
	source: { from: 'written for the tests', what: 'recipe', tags: { genre: 'instructions', theme: 'cooking', era: 'contemporary', form: 'prose' } }
});

await close();
console.log(`${added} new item(s)`);

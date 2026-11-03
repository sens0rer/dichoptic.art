// Adds parallel texts: the same passage in Ukrainian and in English, each item tagged with the pair
// it belongs to, so analysis can compare colours across the two languages for the same meaning.
//   npx tsx scripts/synesthesia/import-parallel.ts
//
// - The Universal Declaration of Human Rights, Articles 1, 3 and 19,
//   in Ukrainian and English (official translations, from the Unicode UDHR project:
//   github.com/eric-muller/udhr).
// - Three short passages written for these tests in English and Ukrainian. They avoid colour
//   words, so meaning and colour association do not get mixed up.
import { add, close, type NewItem } from './pool';

// UDHR file code → language code used on the page. Only the languages she reads: the same text
// in a language she does not know tells nothing about meaning.
const UDHR: Record<string, string> = {
	eng: 'en',
	ukr: 'uk'
};
const ARTICLES = [1, 3, 19];

const decode = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();

async function udhr(): Promise<NewItem[]> {
	const items: NewItem[] = [];
	for (const [code, lang] of Object.entries(UDHR)) {
		const res = await fetch(`https://raw.githubusercontent.com/eric-muller/udhr/master/data/udhr/udhr_${code}.xml`);
		if (!res.ok) {
			console.warn(`UDHR ${code}: HTTP ${res.status}`);
			continue;
		}
		const xml = await res.text();
		for (const n of ARTICLES) {
			// Some files quote attributes with ' rather than ".
			const article = xml.match(new RegExp(`<article number=["']${n}["']>([\\s\\S]*?)</article>`))?.[1];
			const paras = [...(article ?? '').matchAll(/<para>([\s\S]*?)<\/para>/g)].map((m) => decode(m[1]));
			if (!paras.length) {
				console.warn(`UDHR ${code}: article ${n} not found`);
				continue;
			}
			items.push({
				category: 'parallel',
				unit: 'word',
				lang,
				title: `Universal Declaration of Human Rights, Article ${n}`,
				body: paras.join('\n'),
				source: { from: 'udhr', file: code, article: n, pair: `udhr-${n}` }
			});
		}
	}
	return items;
}

// Written for these tests; each English passage has its Ukrainian counterpart.
const OWN: { pair: string; en: string; uk: string }[] = [
	{
		pair: 'own-town',
		en: 'In the morning the rain stopped, and the town slowly came back to life. A woman opened the bakery, a boy ran across the square under a huge umbrella, and the old dog by the fountain shook the water from its fur. Somewhere a radio was playing a song nobody remembered the words to.',
		uk: 'Зранку дощ ущух, і місто поволі ожило. Жінка відчинила пекарню, хлопчик пробіг через площу під величезною парасолькою, а старий пес біля фонтану обтрусив воду з шерсті. Десь грало радіо — пісню, слів якої ніхто не пам’ятав.'
	},
	{
		pair: 'own-fable',
		en: 'A crow found a piece of cheese and flew up into a tree. A fox, who wanted the cheese too, sat down below and began to praise her: such fine feathers, such clever eyes, and surely an even finer voice. The crow opened her beak to sing, and the cheese fell straight into the fox’s mouth.',
		uk: 'Ворона знайшла шматок сиру й злетіла на дерево. Лисиця, якій теж хотілося сиру, сіла під деревом і почала її хвалити: яке гарне пір’я, які розумні очі, а голос, мабуть, ще гарніший. Ворона розкрила дзьоба, щоб заспівати, і сир упав просто лисиці в пащу.'
	},
	{
		pair: 'own-letter',
		en: 'Dear Olena, we reached the mountains on Tuesday. The road was long, but the view from the pass made us forget how tired we were. In the evenings it gets cold, so we sit by the stove and play cards. Tomorrow we want to climb to the lake, if the weather allows. Write to me when you can.',
		uk: 'Дорога Олено, у гори ми дісталися у вівторок. Дорога була довга, але краєвид із перевалу змусив нас забути про втому. Вечорами стає холодно, тож ми сидимо біля печі й граємо в карти. Завтра хочемо піднятися до озера, якщо дозволить погода. Напиши мені, коли зможеш.'
	}
];

const own: NewItem[] = OWN.flatMap((p) =>
	(['en', 'uk'] as const).map((lang) => ({
		category: 'parallel',
		unit: 'word' as const,
		lang,
		body: p[lang],
		source: { from: 'written for the tests', pair: p.pair }
	}))
);

const added = await add([...(await udhr()), ...own]);
await close();
console.log(`${added} new item(s)`);

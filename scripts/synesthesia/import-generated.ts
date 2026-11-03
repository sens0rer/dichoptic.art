// Adds the generated and fixed sets: alphabets, numbers and time words.
//   npx tsx scripts/synesthesia/import-generated.ts        (the base set)
//   npx tsx scripts/synesthesia/import-generated.ts more   (further number and clock-time items)
import { add, close, rng, type NewItem } from './pool';

const spaced = (s: string) => s.trim().split(/\s+/).join('  ');
const src = (what: string) => ({ from: 'generated', what });

// ---- alphabets (one letter per part) ----

// Arabic positional forms are shown with zero-width joiners, which make a letter take the shape it
// has when joined on that side. Letters that never join to the next one have no initial or medial form.
const ZWJ = '‍';
const arabic = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' ');
const rightJoining = new Set('ا د ذ ر ز و'.split(' '));
const forms = (c: string) => (rightJoining.has(c) ? [c, ZWJ + c] : [c, c + ZWJ, ZWJ + c + ZWJ, ZWJ + c]);

const alphabets: { lang: string; title: string; body: string }[] = [
	{ lang: 'en', title: 'English capital letters', body: 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z' },
	{ lang: 'en', title: 'English small letters', body: 'a b c d e f g h i j k l m n o p q r s t u v w x y z' },
	{ lang: 'uk', title: 'Ukrainian capital letters', body: 'А Б В Г Ґ Д Е Є Ж З И І Ї Й К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Ь Ю Я' },
	{ lang: 'uk', title: 'Ukrainian small letters', body: 'а б в г ґ д е є ж з и і ї й к л м н о п р с т у ф х ц ч ш щ ь ю я' },
	{ lang: 'el', title: 'Greek capital letters', body: 'Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω' },
	{ lang: 'el', title: 'Greek small letters', body: 'α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ ς τ υ φ χ ψ ω' },
	{ lang: 'ar', title: 'Arabic letters', body: arabic.join(' ') },
	{ lang: 'ar', title: 'Arabic letters in their joined forms', body: arabic.map((c) => forms(c).join('  ')).join('\n') },
	{ lang: 'he', title: 'Hebrew letters', body: 'א ב ג ד ה ו ז ח ט י כ ל מ נ ס ע פ צ ק ר ש ת' },
	{ lang: 'he', title: 'Hebrew final forms', body: 'ך ם ן ף ץ' },
	{ lang: 'ko', title: 'Korean consonants', body: 'ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ' },
	{ lang: 'ko', title: 'Korean vowels', body: 'ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ ㅡ ㅣ' },
	{ lang: 'ko', title: 'Korean syllable blocks', body: '가 나 다 라 마 바 사 아 자 차 카 타 파 하\n고 노 도 로 모 보 소 오 조 초 코 토 포 호' },
	{
		lang: 'ja',
		title: 'Hiragana',
		body: 'あ い う え お\nか き く け こ\nさ し す せ そ\nた ち つ て と\nな に ぬ ね の\nは ひ ふ へ ほ\nま み む め も\nや ゆ よ\nら り る れ ろ\nわ を ん'
	},
	{
		lang: 'ja',
		title: 'Katakana',
		body: 'ア イ ウ エ オ\nカ キ ク ケ コ\nサ シ ス セ ソ\nタ チ ツ テ ト\nナ ニ ヌ ネ ノ\nハ ヒ フ ヘ ホ\nマ ミ ム メ モ\nヤ ユ ヨ\nラ リ ル レ ロ\nワ ヲ ン'
	},
	{ lang: 'th', title: 'Thai consonants', body: 'ก ข ฃ ค ฅ ฆ ง จ ฉ ช ซ ฌ ญ ฎ ฏ ฐ ฑ ฒ ณ ด ต ถ ท ธ น บ ป ผ ฝ พ ฟ ภ ม ย ร ล ว ศ ษ ส ห ฬ อ ฮ' },
	{ lang: 'th', title: 'Thai vowel signs and tone marks', body: '◌ั ◌ิ ◌ี ◌ึ ◌ื ◌ุ ◌ู ะ า ำ เ แ โ ใ ไ ◌็ ◌่ ◌้ ◌๊ ◌๋ ◌์' },
	{ lang: 'zh', title: 'Common Chinese characters', body: '的 一 是 不 了 人 我 在 有 他 这 中 大 来 上 国 个 到 说 们 为 子 和 你 地 出 道 也 时 年' },
	{ lang: 'zh', title: 'Simple Chinese radicals', body: '人 口 手 心 水 火 木 金 土 日 月 女 山 石 目 言 门 马 鸟 鱼' }
];

// Letters with plenty of room between them, so each is an easy target.
const alphabetItems: NewItem[] = alphabets.map((a) => ({
	...a,
	category: 'alphabets',
	unit: 'char',
	body: a.body.includes('\n') ? a.body : spaced(a.body),
	source: src('alphabet')
}));

// ---- numbers ----

function numberItems(seed: number, count: number): NewItem[] {
	const rnd = rng(seed);
	return Array.from({ length: count }, (_, k) => {
		const nums = Array.from({ length: 12 }, () => {
			const digits = 2 + Math.floor(rnd() * 6);
			return String(Math.floor(10 ** (digits - 1) + rnd() * 9 * 10 ** (digits - 1)));
		});
		return {
			category: 'numbers',
			unit: 'word',
			lang: null,
			body: spaced(nums.join(' ')),
			source: { ...src('multi-digit numbers'), seed, n: k }
		};
	});
}

const numberFixed: NewItem[] = [
	{ category: 'numbers', unit: 'char', lang: null, title: 'Digits', body: spaced('0 1 2 3 4 5 6 7 8 9'), source: src('digits') },
	{
		category: 'numbers',
		unit: 'word',
		lang: 'uk',
		title: 'Number words',
		body: 'нуль один два три чотири п’ять шість сім вісім дев’ять десять\nдвадцять тридцять сорок п’ятдесят шістдесят сімдесят вісімдесят дев’яносто сто тисяча мільйон',
		source: src('number words')
	},
	{
		category: 'numbers',
		unit: 'word',
		lang: 'en',
		title: 'Number words',
		body: 'zero one two three four five six seven eight nine ten\ntwenty thirty forty fifty sixty seventy eighty ninety hundred thousand million',
		source: src('number words')
	}
];

// ---- time ----

const timeFixed: NewItem[] = [
	['uk', 'Days of the week', 'понеділок вівторок середа четвер п’ятниця субота неділя'],
	['en', 'Days of the week', 'Monday Tuesday Wednesday Thursday Friday Saturday Sunday'],
	['uk', 'Months', 'січень лютий березень квітень травень червень липень серпень вересень жовтень листопад грудень'],
	['en', 'Months', 'January February March April May June July August September October November December'],
	['uk', 'Seasons', 'зима весна літо осінь'],
	['en', 'Seasons', 'winter spring summer autumn'],
	['uk', 'Times of day', 'світанок ранок полудень день вечір сутінки ніч опівніч'],
	['en', 'Times of day', 'dawn morning noon afternoon evening dusk night midnight']
].map(([lang, title, body]) => ({
	category: 'time',
	unit: 'word' as const,
	lang,
	title,
	body: body.split(' ').join('\n'),
	source: src('time words')
}));

const monthsUk = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function timeItems(seed: number): NewItem[] {
	const rnd = rng(seed);
	const pick = (n: number) => Math.floor(rnd() * n);
	const clock = Array.from({ length: 10 }, () => `${String(pick(24)).padStart(2, '0')}:${String(pick(4) * 15).padStart(2, '0')}`);
	const dates = Array.from({ length: 8 }, () => [1 + pick(28), pick(12)] as const);
	return [
		{ category: 'time', unit: 'word', lang: null, title: 'Clock times', body: spaced(clock.join(' ')), source: { ...src('clock times'), seed } },
		{ category: 'time', unit: 'word', lang: 'uk', title: 'Dates', body: dates.map(([d, m]) => `${d} ${monthsUk[m]}`).join('\n'), source: { ...src('dates'), seed } },
		{ category: 'time', unit: 'word', lang: 'en', title: 'Dates', body: dates.map(([d, m]) => `${monthsEn[m]} ${d}`).join('\n'), source: { ...src('dates'), seed } }
	];
}

const more = process.argv[2] === 'more';
// "more" uses a fresh seed each run, so it always adds new items.
const seed = more ? 1000 + (Math.floor(Date.now() / 1000) % 1000000) : 1;

const items: NewItem[] = more
	? [...numberItems(seed, 3), ...timeItems(seed)]
	: [...alphabetItems, ...numberFixed, ...numberItems(seed, 3), ...timeFixed, ...timeItems(seed)];

const added = await add(items);
await close();
console.log(`${added} new item(s)`);

// Adds maths items: three expressions each, from one school topic, written in LaTeX and stored
// as MathML (converted here with Temml), so the page shows real typesetting.
//   npx tsx scripts/synesthesia/import-maths.ts        (the curated set)
//   npx tsx scripts/synesthesia/import-maths.ts more   (new arithmetic and algebra items with random numbers)
// Notation follows Ukrainian school use: ":" for division, tg and ctg, lg for log base 10.
import temml from 'temml';
import { add, close, rng, type NewItem } from './pool';

const TOPICS: { title: string; tex: string[] }[] = [
	{ title: 'Arithmetic', tex: [String.raw`37 + 48 = 85`, String.raw`96 : 8 = 12`, String.raw`(15 - 7) \cdot 4 = 32`] },
	{ title: 'Fractions', tex: [String.raw`\frac{1}{2} + \frac{1}{3} = \frac{5}{6}`, String.raw`\frac{3}{4} \cdot \frac{2}{9} = \frac{1}{6}`, String.raw`2\frac{1}{5} = \frac{11}{5}`] },
	{ title: 'Decimals and percentages', tex: [String.raw`0{,}25 = \frac{1}{4}`, String.raw`12\% \text{ від } 50 = 6`, String.raw`3{,}6 : 0{,}9 = 4`] },
	{ title: 'Powers and roots', tex: [String.raw`2^{10} = 1024`, String.raw`\sqrt{81} = 9`, String.raw`\sqrt[3]{27} = 3`] },
	{ title: 'Algebraic identities', tex: [String.raw`(a + b)^2 = a^2 + 2ab + b^2`, String.raw`a^2 - b^2 = (a - b)(a + b)`, String.raw`x^{-1} = \frac{1}{x}`] },
	{ title: 'Equations', tex: [String.raw`2x + 3 = 11`, String.raw`x^2 - 5x + 6 = 0`, String.raw`x_{1,2} = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`] },
	{ title: 'Inequalities and absolute value', tex: [String.raw`x \le 5`, String.raw`|x - 2| < 3`, String.raw`-1 < x < 5`] },
	{ title: 'Functions and graphs', tex: [String.raw`y = kx + b`, String.raw`y = x^2`, String.raw`f(x) = \frac{1}{x}`] },
	{ title: 'Trigonometry', tex: [String.raw`\sin^2 \alpha + \cos^2 \alpha = 1`, String.raw`\operatorname{tg} \alpha = \frac{\sin \alpha}{\cos \alpha}`, String.raw`\sin 30^\circ = \frac{1}{2}`] },
	{ title: 'Logarithms and exponents', tex: [String.raw`\log_2 8 = 3`, String.raw`\lg 100 = 2`, String.raw`a^{\log_a b} = b`] },
	{ title: 'Sequences', tex: [String.raw`a_n = a_1 + (n - 1)d`, String.raw`b_n = b_1 q^{n - 1}`, String.raw`S_n = \frac{(a_1 + a_n) n}{2}`] },
	{ title: 'Geometry', tex: [String.raw`a^2 + b^2 = c^2`, String.raw`S = \pi r^2`, String.raw`\angle A + \angle B + \angle C = 180^\circ`] },
	{ title: 'Limits', tex: [String.raw`\lim_{x \to 0} \frac{\sin x}{x} = 1`, String.raw`\lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e`, String.raw`\lim_{x \to 2} (3x - 1) = 5`] },
	{ title: 'Derivatives', tex: [String.raw`(x^n)' = n x^{n - 1}`, String.raw`(\sin x)' = \cos x`, String.raw`f'(x) = \lim_{\Delta x \to 0} \frac{f(x + \Delta x) - f(x)}{\Delta x}`] },
	{ title: 'Integrals', tex: [String.raw`\int x^2 \, dx = \frac{x^3}{3} + C`, String.raw`\int_0^1 x \, dx = \frac{1}{2}`, String.raw`\int_a^b f(x) \, dx = F(b) - F(a)`] }
];

// Fresh numbers for arithmetic and linear equations, for when the curated items are used up.
function randomTopics(seed: number) {
	const rnd = rng(seed);
	const n = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
	const a = n(12, 99), b = n(12, 99), c = n(3, 9), d = n(2, 9);
	const x = n(2, 12), k = n(2, 9), m = n(1, 20);
	return [
		{ title: 'Arithmetic', tex: [`${a} + ${b} = ${a + b}`, `${c * d} : ${d} = ${c}`, `${a} - ${c} \\cdot ${d} = ${a - c * d}`] },
		{ title: 'Equations', tex: [`${k}x + ${m} = ${k * x + m}`, `x = ${x}`, `\\frac{x}{${d}} = ${c}`] }
	];
}

const render = (tex: string) => {
	const out = temml.renderToString(tex, { displayMode: true, throwOnError: true });
	// Temml's helper classes and inline styles are for its own stylesheet; the page styles maths itself.
	return out.replace(/ class="[^"]*"/g, '').replace(/ style="[^"]*"/g, '');
};

const more = process.argv[2] === 'more';
const seed = more ? 1000 + (Math.floor(Date.now() / 1000) % 1000000) : 0;
const topics = more ? randomTopics(seed) : TOPICS;

const items: NewItem[] = topics.map((t) => ({
	category: 'maths',
	unit: 'math',
	lang: null,
	title: t.title,
	body: t.tex.map(render).join('\n'),
	source: { from: 'generated', what: 'maths', latex: t.tex, ...(more ? { seed } : {}) }
}));

const added = await add(items);
await close();
console.log(`${added} new item(s)`);

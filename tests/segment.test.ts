import { describe, expect, it } from 'vitest';
import { allCovered, nextUncovered, parse } from '../src/lib/synesthesia/segment';

describe('parse', () => {
	it('splits words and ignores punctuation as units', () => {
		const p = parse('Добрий день, світе!', 'word', 'uk');
		const words = p.units.map((u) => p.graphemes.slice(u.start, u.end).join(''));
		expect(words).toEqual(['Добрий', 'день', 'світе']);
	});

	it('counts graphemes, not code units', () => {
		const p = parse('é👍🏽a', 'char');
		expect(p.graphemes).toEqual(['é', '👍🏽', 'a']);
		expect(p.units).toHaveLength(3);
	});

	it('letter items count letters, digits and symbols, not joiners or punctuation', () => {
		// Arabic ba in its initial, medial and final forms, shown with zero-width joiners.
		const p = parse('ب‍ ‍ب‍ ‍ب ، 1', 'char', 'ar');
		const parts = p.units.map((u) => p.graphemes.slice(u.start, u.end).join('').replace(/‍/g, ''));
		expect(parts).toEqual(['ب', 'ب', 'ب', '1']);
	});

	it('takes MathML symbols as parts, skipping invisible operators', () => {
		const mathml =
			'<math><mrow><mi>sin</mi><mo>⁡</mo><mspace width="0.1667em"></mspace><mi>x</mi><mo>&lt;</mo><mfrac><mn>1</mn><mn>2</mn></mfrac></mrow></math>';
		const p = parse(mathml, 'math');
		expect(p.graphemes).toEqual(['sin', 'x', '<', '1', '2']);
		expect(p.units).toHaveLength(5);
	});

	it('counts the √ of a root as a symbol, before what is under it', () => {
		const p = parse('<math><mrow><msqrt><mi>x</mi></msqrt><mo>+</mo><mroot><mn>8</mn><mn>3</mn></mroot></mrow></math>', 'math');
		expect(p.graphemes).toEqual(['√', 'x', '+', '√', '8', '3']);
	});

	it('finds words in Thai, which has no spaces', () => {
		const p = parse('สวัสดีครับ', 'word', 'th');
		expect(p.units.length).toBeGreaterThan(1);
	});
});

describe('coverage', () => {
	const p = parse('one two three', 'word');
	it('treats a word as covered when its letters are covered separately', () => {
		expect(allCovered(p, [{ start: 0, end: 3 }, { start: 4, end: 5 }, { start: 5, end: 7 }, { start: 8, end: 13 }])).toBe(true);
		expect(allCovered(p, [{ start: 0, end: 3 }, { start: 4, end: 6 }, { start: 8, end: 13 }])).toBe(false);
	});
	it('a sentence-long answer covers every word in it', () => {
		expect(allCovered(p, [{ start: 0, end: 13 }])).toBe(true);
	});
	it('finds the next open word, wrapping round', () => {
		expect(nextUncovered(p, [{ start: 4, end: 7 }], 4)).toEqual({ start: 8, end: 13 });
		expect(nextUncovered(p, [{ start: 4, end: 13 }], 8)).toEqual({ start: 0, end: 3 });
		expect(nextUncovered(p, [{ start: 0, end: 13 }], 0)).toBeNull();
	});
});

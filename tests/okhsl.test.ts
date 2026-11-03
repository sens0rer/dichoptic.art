import { describe, expect, it } from 'vitest';
import { colour, okhslToSrgb, srgbToOkhsl } from '../src/lib/synesthesia/okhsl';

describe('okhsl', () => {
	it('round-trips sRGB colours', () => {
		let seed = 1;
		const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
		for (let i = 0; i < 2000; i++) {
			const rgb: [number, number, number] = [rnd(), rnd(), rnd()];
			const [h, s, l] = srgbToOkhsl(rgb);
			const back = okhslToSrgb(h, s, l);
			for (let k = 0; k < 3; k++) expect(back[k]).toBeCloseTo(rgb[k], 3);
		}
	});

	it('keeps every (h, s, l) inside sRGB', () => {
		for (let h = 0; h < 1; h += 0.05)
			for (let s = 0; s <= 1.0001; s += 0.1)
				for (let l = 0.02; l < 1; l += 0.1) {
					const rgb = okhslToSrgb(h, s, l);
					for (const x of rgb) {
						expect(Number.isFinite(x)).toBe(true);
						expect(x).toBeGreaterThanOrEqual(0);
						expect(x).toBeLessThanOrEqual(1);
					}
				}
	});

	it('maps the corners sensibly', () => {
		expect(colour(0, 0, 0).hex).toBe('#000000');
		expect(colour(0, 0, 1).hex).toBe('#ffffff');
		// Grey has equal channels at any hue.
		const g = colour(0.3, 0, 0.5).hex;
		expect(g.slice(1, 3)).toBe(g.slice(3, 5));
		expect(g.slice(3, 5)).toBe(g.slice(5, 7));
		// Full saturation reaches the gamut edge: one channel at 0 or 255.
		const red = okhslToSrgb(srgbToOkhsl([1, 0, 0])[0], 1, srgbToOkhsl([1, 0, 0])[2]);
		expect(red[0]).toBeCloseTo(1, 2);
		expect(red[1]).toBeCloseTo(0, 2);
	});
});

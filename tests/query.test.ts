import { describe, expect, it } from 'vitest';
import { normName, parseQuery, toParams } from '../src/lib/query';

describe('query params', () => {
	it('round-trips filters and sort', () => {
		const p = new URLSearchParams('sort=liked&q=sunset&medium=photography&tag=Sea&tag=sky&by=%20Seed%20%20Bot');
		const { filters, sort } = parseQuery(p);
		expect(sort).toBe('liked');
		expect(filters).toMatchObject({ q: 'sunset', medium: 'photography', tags: ['sea', 'sky'], by: 'seed bot' });
		expect(parseQuery(toParams(filters, sort))).toEqual({ filters, sort });
	});

	it('drops values outside the fixed vocabularies', () => {
		const { filters } = parseQuery(new URLSearchParams('medium=oil&chromacy=tetra&dimension='));
		expect(filters.medium).toBe('');
		expect(filters.chromacy).toBe('tetra');
		expect(filters.dimension).toBe('');
	});

	it('normalises submitter names', () => {
		expect(normName('  Jane   DOE ')).toBe('jane doe');
	});
});

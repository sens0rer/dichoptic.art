import { describe, expect, it } from 'vitest';
import { creditText, parseCredit } from '../src/lib/credit';
import { collectionMetaSchema, imageMetaSchema } from '../src/lib/server/meta';

describe('image metadata', () => {
	it('requires a title unless inside a collection', () => {
		expect(imageMetaSchema(true).safeParse({ title: ' ' }).success).toBe(false);
		expect(imageMetaSchema(false).parse({}).title).toBeNull();
	});

	it('turns empty selections into null and normalises tags', () => {
		const m = imageMetaSchema(true).parse({
			title: 'x',
			dimension: '',
			tags: ['  Red  Sky ', 'red sky', 'B']
		});
		expect(m.dimension).toBeNull();
		expect(m.tags).toEqual(['red sky', 'b']);
	});

	it('drops chromacy type when chromacy is none', () => {
		const m = imageMetaSchema(true).parse({ title: 'x', chromacy: 'none', chromacyType: 'TRT' });
		expect(m.chromacyType).toBeNull();
	});

	it('links words in credit and adds https:// to bare addresses', () => {
		const m = imageMetaSchema(true).parse({ title: 'x', credit: 'Photo by [Jane](janedoe.com) and Bob' });
		expect(m.credit).toBe('Photo by [Jane](https://janedoe.com) and Bob');
		expect(parseCredit(m.credit!)).toEqual([
			{ text: 'Photo by ' },
			{ text: 'Jane', href: 'https://janedoe.com' },
			{ text: ' and Bob' }
		]);
	});

	it('rejects credit links that are not web addresses', () => {
		expect(imageMetaSchema(true).safeParse({ title: 'x', credit: '[x](javascript:alert(1))' }).success).toBe(false);
		expect(imageMetaSchema(true).safeParse({ title: 'x', credit: '[x](hello)' }).success).toBe(false);
	});

	it('shows credit without link syntax in search text', () => {
		expect(creditText('Photo by [Jane](https://janedoe.com)')).toBe('Photo by Jane');
	});

	it('rejects unknown vocabulary values', () => {
		expect(collectionMetaSchema.safeParse({ title: 'c', medium: 'oil' }).success).toBe(false);
	});
});

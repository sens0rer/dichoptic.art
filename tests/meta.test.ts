import { describe, expect, it } from 'vitest';
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

	it('accepts a bare domain as a credit link', () => {
		expect(imageMetaSchema(true).parse({ title: 'x', creditUrl: 'wikipedia.com' }).creditUrl).toBe(
			'https://wikipedia.com'
		);
	});

	it('only accepts http(s) credit links', () => {
		expect(imageMetaSchema(true).safeParse({ title: 'x', creditUrl: 'javascript:alert(1)' }).success).toBe(false);
		expect(imageMetaSchema(true).safeParse({ title: 'x', creditUrl: 'https://example.com/a' }).success).toBe(true);
	});

	it('rejects unknown vocabulary values', () => {
		expect(collectionMetaSchema.safeParse({ title: 'c', medium: 'oil' }).success).toBe(false);
	});
});

import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { prepare, UploadError } from '../src/lib/server/process';

const hamming = (a: string, b: string) => [...a].filter((c, i) => c !== b[i]).length;
const sample = (n: string) => readFile(`samples/${n}`);

describe('pair preparation', () => {
	it('keeps a single file as uploaded and reports its size', async () => {
		const buf = await sample('photo_2026-09-17_16-16-29.jpg');
		const p = await prepare('single_file', { left: buf });
		expect(p.pair).toBe(buf);
		expect([p.left.width, p.left.height]).toEqual([1280, 480]);
		expect(p.phash).toMatch(/^[01]{64}$/);
	});

	it('hashes a resized copy close to the original', async () => {
		const buf = await sample('photo_2026-09-17_16-16-29.jpg');
		const small = await sharp(buf).resize({ width: 500 }).jpeg({ quality: 60 }).toBuffer();
		const a = await prepare('single_file', { left: buf });
		const b = await prepare('single_file', { left: small });
		expect(hamming(a.phash, b.phash)).toBeLessThanOrEqual(6);
	});

	it('joins two files side by side, so the same pair matches whichever way it was uploaded', async () => {
		const left = await sample('photo_2026-10-06_10-36-09.jpg');
		const right = await sample('photo_2026-10-06_10-36-09 (2).jpg');
		const two = await prepare('two_files', { left, right });
		const meta = await sharp(two.pair).metadata();
		expect(meta.width).toBe(2560);
		const asOne = await prepare('single_file', { left: await sharp(two.pair).jpeg({ quality: 92 }).toBuffer() });
		expect(hamming(two.phash, asOne.phash)).toBeLessThanOrEqual(6);
	});

	it('rejects non-images and unsupported formats', async () => {
		await expect(prepare('single_file', { left: Buffer.from('nope') })).rejects.toBeInstanceOf(UploadError);
		const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).gif().toBuffer();
		await expect(prepare('single_file', { left: gif })).rejects.toThrow(/JPEG, PNG and WebP/);
	});
});

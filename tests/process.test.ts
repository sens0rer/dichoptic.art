import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { prepare, UploadError } from '../src/lib/server/process';

const hamming = (a: string, b: string) => [...a].filter((c, i) => c !== b[i]).length;
// Same rule as the SQL in submissions.ts findDuplicate.
const isDuplicate = (a: string, b: string) =>
	hamming(a.slice(0, 64), b.slice(0, 64)) <= 6 && hamming(a.slice(64), b.slice(64)) <= 12;

let left: Buffer;
let right: Buffer;
let sideBySide: Buffer;

beforeAll(async () => {
	left = await readFile('samples/avalokiteshvara-left.png');
	right = await readFile('samples/avalokiteshvara-right.png');
	const { width, height } = await sharp(left).metadata();
	sideBySide = await sharp({ create: { width: width! * 2, height: height!, channels: 3, background: '#000' } })
		.composite([
			{ input: left, left: 0, top: 0 },
			{ input: right, left: width!, top: 0 }
		])
		.png()
		.toBuffer();
});

describe('pair preparation', () => {
	it('keeps a single file as uploaded and reports its size', async () => {
		const p = await prepare('single_file', { left: sideBySide });
		expect(p.pair).toBe(sideBySide);
		expect([p.left.width, p.left.height]).toEqual([1600, 976]);
		expect(p.phash).toMatch(/^[01]{256}$/);
	});

	it('hashes a resized copy close to the original', async () => {
		const small = await sharp(sideBySide).resize({ width: 500 }).jpeg({ quality: 60 }).toBuffer();
		const a = await prepare('single_file', { left: sideBySide });
		const b = await prepare('single_file', { left: small });
		expect(isDuplicate(a.phash, b.phash)).toBe(true);
	});

	it('joins two files side by side, so the same pair matches whichever way it was uploaded', async () => {
		const two = await prepare('two_files', { left, right });
		expect((await sharp(two.pair).metadata()).width).toBe(1600);
		const asOne = await prepare('single_file', { left: await sharp(two.pair).jpeg({ quality: 92 }).toBuffer() });
		expect(isDuplicate(two.phash, asOne.phash)).toBe(true);
	});

	it('does not treat the same picture in different colours as a duplicate', async () => {
		const brown = await prepare('single_file', { left });
		const green = await prepare('single_file', { left: right });
		expect(isDuplicate(brown.phash, green.phash)).toBe(false);
	});

	it('rejects non-images and unsupported formats', async () => {
		await expect(prepare('single_file', { left: Buffer.from('nope') })).rejects.toBeInstanceOf(UploadError);
		const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).gif().toBuffer();
		await expect(prepare('single_file', { left: gif })).rejects.toThrow(/JPEG, PNG and WebP/);
	});
});

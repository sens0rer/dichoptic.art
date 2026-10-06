import sharp, { type Metadata } from 'sharp';
import { ACCEPTED_TYPES, MAX_FILE_BYTES } from '../vocab';
import type { SourceMode } from '../vocab';

const FORMATS = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
export type Format = keyof typeof FORMATS;

export class UploadError extends Error {}

export interface Original {
	buf: Buffer;
	format: Format;
	width: number;
	height: number;
}

// sharp reports pre-rotation size; swap for EXIF orientations 5-8 so it matches what is shown.
async function inspect(buf: Buffer, label: string): Promise<Original> {
	if (buf.length > MAX_FILE_BYTES) throw new UploadError(`${label}: file is larger than 20 MB`);
	let meta: Metadata;
	try {
		meta = await sharp(buf).metadata();
	} catch {
		throw new UploadError(`${label}: not a readable image`);
	}
	const format = meta.format as Format;
	if (!(format in FORMATS) || !ACCEPTED_TYPES.includes(FORMATS[format]))
		throw new UploadError(`${label}: only JPEG, PNG and WebP are accepted`);
	const rotated = (meta.orientation ?? 1) >= 5;
	const width = (rotated ? meta.height : meta.width) ?? 0;
	const height = (rotated ? meta.width : meta.height) ?? 0;
	if (!width || !height) throw new UploadError(`${label}: image has no size`);
	return { buf, format, width, height };
}

export interface Prepared {
	mode: SourceMode;
	left: Original;
	right: Original | null;
	// The side-by-side image: the file itself, or the composite of both.
	pair: Buffer;
	// 256 characters of 0/1, see fingerprint().
	phash: string;
}

export const upright = (buf: Buffer) => sharp(buf).rotate();

async function composite(l: Original, r: Original): Promise<Buffer> {
	const h = Math.min(l.height, r.height, 1600);
	const side = (o: Original) =>
		upright(o.buf)
			.resize({ height: h })
			.flatten({ background: '#000' })
			.png()
			.toBuffer({ resolveWithObject: true });
	const [a, b] = await Promise.all([side(l), side(r)]);
	return sharp({
		create: { width: a.info.width + b.info.width, height: h, channels: 3, background: '#000' }
	})
		.composite([
			{ input: a.data, left: 0, top: 0 },
			{ input: b.data, left: a.info.width, top: 0 }
		])
		.png()
		.toBuffer();
}

// Fingerprint of the pair image, 256 bits, for the duplicate check:
//  - bits 0-63: dHash of the grayscale picture (9x8, one bit per left>right neighbour comparison),
//    so the same picture matches after resizing or recompression;
//  - bits 64-255: a 4x4 colour layout, 4 bits (Gray-coded, 16 levels) per channel per cell, so the
//    same picture in different colours does NOT match. Colour variants are the point of this site.
//    Gray code makes the Hamming distance grow with the size of the colour change.
export const HASH_STRUCTURE_BITS = 64;
export const HASH_COLOUR_BITS = 192;

async function fingerprint(pair: Buffer): Promise<string> {
	const base = () => upright(pair).flatten({ background: '#000' });
	const grey = await base().resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer();
	let bits = '';
	for (let y = 0; y < 8; y++)
		for (let x = 0; x < 8; x++) bits += grey[y * 9 + x] > grey[y * 9 + x + 1] ? '1' : '0';
	const rgb = await base().resize(4, 4, { fit: 'fill' }).removeAlpha().toColourspace('srgb').raw().toBuffer();
	for (const v of rgb) {
		const level = v >> 4;
		bits += (level ^ (level >> 1)).toString(2).padStart(4, '0');
	}
	return bits;
}

export async function prepare(
	mode: SourceMode,
	buffers: { left: Buffer; right?: Buffer }
): Promise<Prepared> {
	if (mode === 'single_file') {
		const left = await inspect(buffers.left, 'Image');
		return { mode, left, right: null, pair: left.buf, phash: await fingerprint(left.buf) };
	}
	if (!buffers.right) throw new UploadError('Both images are required');
	const [left, right] = await Promise.all([
		inspect(buffers.left, 'Left image'),
		inspect(buffers.right, 'Right image')
	]);
	const pair = await composite(left, right);
	return { mode, left, right, pair, phash: await fingerprint(pair) };
}

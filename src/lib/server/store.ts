import { THUMB_WIDTHS } from '../vocab';
import { makeThumbs, type Prepared } from './process';
import { storage } from './storage';

const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp' } as const;

export interface StoredPair {
	fileKey: string | null;
	leftKey: string | null;
	rightKey: string | null;
	leftW: number;
	leftH: number;
	rightW: number | null;
	rightH: number | null;
	thumbPrefix: string;
	thumbW: number;
	thumbH: number;
	bytes: number;
}

// Writes thumbnails and consumes the tmp originals under img/<imageId>/<fresh>-*. A fresh name per
// upload means a replace never overwrites files that may still be cached.
export async function storePair(
	imageId: string,
	fresh: string,
	p: Prepared,
	tmpKeys: { left: string; right?: string }
): Promise<StoredPair> {
	const base = `img/${imageId}/${fresh}`;
	let bytes = p.left.buf.length + (p.right?.buf.length ?? 0);
	const thumbs = await makeThumbs(p.pair);
	for (const t of thumbs) {
		await storage.put(`${base}-${t.width}.webp`, t.data, 'image/webp');
		bytes += t.data.length;
	}
	const { w: thumbW, h: thumbH } = thumbs[thumbs.length - 1];
	const common = { thumbPrefix: base, thumbW, thumbH, bytes, leftW: p.left.width, leftH: p.left.height };
	if (p.mode === 'single_file') {
		const fileKey = `${base}-file.${EXT[p.left.format]}`;
		await storage.move(tmpKeys.left, fileKey);
		return { ...common, fileKey, leftKey: null, rightKey: null, rightW: null, rightH: null };
	}
	const leftKey = `${base}-left.${EXT[p.left.format]}`;
	const rightKey = `${base}-right.${EXT[p.right!.format]}`;
	await storage.move(tmpKeys.left, leftKey);
	await storage.move(tmpKeys.right!, rightKey);
	return {
		...common,
		fileKey: null,
		leftKey,
		rightKey,
		rightW: p.right!.width,
		rightH: p.right!.height
	};
}

export const imageKeys = (i: {
	fileKey: string | null;
	leftKey: string | null;
	rightKey: string | null;
	thumbPrefix: string;
}) => [
	...[i.fileKey, i.leftKey, i.rightKey].filter((k): k is string => !!k),
	...THUMB_WIDTHS.map((w) => `${i.thumbPrefix}-${w}.webp`)
];

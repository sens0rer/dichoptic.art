import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

// The two halves in samples/ are the only checked-in sample images. The single side-by-side file is
// built from them and mirrored, so it is a different picture from the left+right pair.
export const files = {
	left: 'samples/avalokiteshvara-left.png',
	right: 'samples/avalokiteshvara-right.png',
	single: join(tmpdir(), 'dichoptic-sample-single.png')
};

export async function prepareSamples() {
	const [l, r] = await Promise.all([sharp(files.left).png().toBuffer(), sharp(files.right).png().toBuffer()]);
	const { width, height } = await sharp(l).metadata();
	await sharp({ create: { width: width! * 2, height: height!, channels: 3, background: '#000' } })
		.composite([
			{ input: l, left: 0, top: 0 },
			{ input: r, left: width!, top: 0 }
		])
		.flop()
		.png()
		.toFile(files.single);
}

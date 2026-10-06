import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { config } from '../config';
import type { PresignedUpload, Storage } from './types';

const rootDir = () => resolve(config.uploadDir);
const DAY = 24 * 60 * 60 * 1000;

function pathFor(key: string): string {
	const root = rootDir();
	const p = resolve(root, key);
	if (!p.startsWith(root + sep)) throw new Error('invalid storage key');
	return p;
}

const sign = (payload: string) =>
	createHmac('sha256', config.secret).update(payload).digest('base64url');

export interface UploadGrant {
	key: string;
	contentType: string;
	maxBytes: number;
}

export function verifyUploadToken(token: string): UploadGrant | null {
	const [payload, sig] = token.split('.');
	if (!payload || !sig) return null;
	const expected = Buffer.from(sign(payload));
	const given = Buffer.from(sig);
	if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
	const grant = JSON.parse(Buffer.from(payload, 'base64url').toString()) as UploadGrant & {
		exp: number;
	};
	return grant.exp > Date.now() ? grant : null;
}

export const localStorageImpl: Storage = {
	async presignUpload(key, { contentType, maxBytes }): Promise<PresignedUpload> {
		const payload = Buffer.from(
			JSON.stringify({ key, contentType, maxBytes, exp: Date.now() + 60 * 60 * 1000 })
		).toString('base64url');
		return {
			url: `/api/upload/${payload}.${sign(payload)}`,
			method: 'PUT',
			headers: { 'content-type': contentType }
		};
	},
	async put(key, data) {
		const p = pathFor(key);
		await mkdir(dirname(p), { recursive: true });
		await writeFile(p, data);
	},
	async get(key) {
		return readFile(pathFor(key));
	},
	async move(from, to) {
		const dest = pathFor(to);
		await mkdir(dirname(dest), { recursive: true });
		await rename(pathFor(from), dest);
	},
	async delete(key) {
		await rm(pathFor(key), { force: true });
	},
	url(key) {
		return `/files/${key}`;
	}
};

// Stand-in for the R2 lifecycle rule: drop tmp files older than a day.
export async function sweepTmp() {
	const dir = join(rootDir(), 'tmp');
	try {
		for (const name of await readdir(dir)) {
			const p = join(dir, name);
			if (Date.now() - (await stat(p)).mtimeMs > DAY) await rm(p, { force: true });
		}
	} catch {
		// no tmp dir yet
	}
}

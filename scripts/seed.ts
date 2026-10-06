// Fills a running dev server with the sample pairs, through the same endpoints the upload page uses.
import { readFile } from 'node:fs/promises';
import { files, prepareSamples } from './sample-files';

const base = process.env.BASE_URL ?? 'http://localhost:5173';
let cookie = '';

async function call(path: string, init: RequestInit & { json?: unknown } = {}) {
	const res = await fetch(base + path, {
		method: init.method ?? (init.json ? 'POST' : 'GET'),
		headers: {
			'x-consent': 'accepted',
			cookie,
			...(init.json ? { 'content-type': 'application/json' } : {}),
			...init.headers
		},
		body: init.json ? JSON.stringify(init.json) : init.body
	});
	const set = res.headers.getSetCookie().find((c) => c.startsWith('owner_key='));
	if (set) cookie = set.split(';')[0];
	return { status: res.status, data: (await res.json()) as Record<string, any> };
}

async function upload(file: string): Promise<string> {
	const bytes = await readFile(file);
	const presign = await call('/api/upload/presign', {
		json: { files: [{ type: 'image/png', size: bytes.length }] }
	});
	const { id, url } = presign.data.uploads[0];
	const res = await fetch(base + url, {
		method: 'PUT',
		headers: { 'content-type': 'image/png' },
		body: bytes
	});
	if (!res.ok) throw new Error(`upload failed: ${res.status}`);
	return id;
}

await prepareSamples();
const single = await upload(files.single);
const left = await upload(files.left);
const right = await upload(files.right);

const one = await call('/api/images', {
	json: {
		meta: {
			title: 'Mirrored thangka',
			credit: 'Sample',
			submittedBy: 'Seed Bot',
			dimension: '2D',
			medium: 'photography',
			chromacy: 'di',
			tags: ['thangka', 'painting']
		},
		pair: { mode: 'single_file', left: single },
		confirm: true
	}
});
console.log('single:', one.status, one.data);

const two = await call('/api/images', {
	json: {
		meta: {
			title: 'Thangka pair',
			submittedBy: 'Seed Bot',
			author: 'Seed Bot',
			dimension: '2D',
			medium: 'photography',
			chromacy: 'di',
			tags: ['thangka', 'two files']
		},
		pair: { mode: 'two_files', left, right },
		confirm: true
	}
});
console.log('two files:', two.status, two.data);
console.log('owner cookie:', cookie ? 'set' : 'none');

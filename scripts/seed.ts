// Fills a running dev server with the sample pairs, through the same endpoints the upload page uses.
import { readFile } from 'node:fs/promises';

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
		json: { files: [{ type: 'image/jpeg', size: bytes.length }] }
	});
	const { id, url } = presign.data.uploads[0];
	const res = await fetch(base + url, {
		method: 'PUT',
		headers: { 'content-type': 'image/jpeg' },
		body: bytes
	});
	if (!res.ok) throw new Error(`upload failed: ${res.status}`);
	return id;
}

const dir = 'samples/';
const sunset = await upload(`${dir}photo_2026-09-17_16-16-29.jpg`);
const left = await upload(`${dir}photo_2026-10-06_10-36-09.jpg`);
const right = await upload(`${dir}photo_2026-10-06_10-36-09 (2).jpg`);

const one = await call('/api/images', {
	json: {
		meta: {
			title: 'Sunset islet',
			credit: 'Sample',
			submittedBy: 'Seed Bot',
			dimension: '2D',
			medium: 'photography',
			alteration: 'digitally_altered',
			chromacy: 'tetra',
			chromacyType: 'TRT',
			filterInfo: 'red / cyan',
			tags: ['sunset', 'sea']
		},
		pair: { mode: 'single_file', left: sunset },
		confirm: true
	}
});
console.log('single:', one.status, one.data);

const two = await call('/api/images', {
	json: {
		meta: {
			title: 'Cottonwoods',
			submittedBy: 'Seed Bot',
			author: 'Seed Bot',
			dimension: '2D',
			medium: 'photography',
			chromacy: 'di',
			tags: ['trees', 'infrared']
		},
		pair: { mode: 'two_files', left, right },
		confirm: true
	}
});
console.log('two files:', two.status, two.data);
console.log('owner cookie:', cookie ? 'set' : 'none');

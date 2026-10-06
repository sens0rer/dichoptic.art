import { readFile } from 'node:fs/promises';

const base = 'http://localhost:5173';
const jars: Record<string, string> = { a: '', b: '' };

async function call(who: string, path: string, init: any = {}) {
	const res = await fetch(base + path, {
		method: init.method ?? (init.json ? 'POST' : 'GET'),
		redirect: 'manual',
		headers: {
			'x-consent': 'accepted',
			cookie: jars[who],
			...(init.json ? { 'content-type': 'application/json' } : {})
		},
		body: init.json ? JSON.stringify(init.json) : undefined
	});
	const set = res.headers.getSetCookie().find((c) => c.startsWith('owner_key='));
	if (set) jars[who] = set.split(';')[0];
	const text = await res.text();
	let data: any = text;
	try {
		data = JSON.parse(text);
	} catch {}
	return { status: res.status, data };
}

async function upload(file: string) {
	const bytes = await readFile(file);
	const p = await call('a', '/api/upload/presign', { json: { files: [{ type: 'image/jpeg', size: bytes.length }] } });
	const { id, url } = p.data.uploads[0];
	await fetch(base + url, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: bytes });
	return id as string;
}
const S = 'samples/';
const check = (name: string, ok: boolean, extra?: unknown) =>
	console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : JSON.stringify(extra));

// duplicate of the seeded single sunset file
let sunset = await upload(S + 'photo_2026-09-17_16-16-29.jpg');
let r = await call('a', '/api/images', { json: { meta: { title: 'Dup' }, pair: { mode: 'single_file', left: sunset } } });
check('duplicate detected', !!r.data.duplicate, r);
r = await call('a', '/api/images', { json: { meta: { title: 'Dup' }, pair: { mode: 'single_file', left: sunset }, confirm: true } });
check('submit anyway', r.status === 200 && !!r.data.id, r);
const dupId = r.data.id;

// the two-file trees uploaded as two files duplicates the existing two-file pair
const l = await upload(S + 'photo_2026-10-06_10-36-09.jpg');
const rr = await upload(S + 'photo_2026-10-06_10-36-09 (2).jpg');
r = await call('a', '/api/images', { json: { meta: { title: 'Trees again' }, pair: { mode: 'two_files', left: l, right: rr } } });
check('two-file duplicate detected', !!r.data.duplicate, r);

// validation
r = await call('a', '/api/images', { json: { meta: { title: '' }, pair: { mode: 'single_file', left: 'x'.repeat(20) } } });
check('title required', r.status === 400 && !!r.data.errors?.title, r);
const bad = await call('a', '/api/upload/presign', { json: { files: [{ type: 'image/gif', size: 100 }] } });
check('gif rejected', bad.status === 400, bad);
const big = await call('a', '/api/upload/presign', { json: { files: [{ type: 'image/png', size: 30 * 1024 * 1024 }] } });
check('over 20MB rejected', big.status === 400, big);

// collection
const c1 = await upload(S + 'photo_2026-10-06_10-36-09.jpg');
const c2 = await upload(S + 'photo_2026-10-06_10-36-09 (2).jpg');
r = await call('a', '/api/collections', {
	json: {
		collection: { title: 'Trees collection', medium: 'photography', tags: ['Trees', 'summer'], submittedBy: 'Smoke', chromacy: 'tri', chromacyType: 'x' },
		items: [{ meta: { title: 'one', dimension: '3D' }, pair: { mode: 'two_files', left: c1, right: c2 } }],
		confirm: true
	}
});
check('collection created', r.status === 200 && !!r.data.id, r);
const colId = r.data.id;
r = await call('a', `/collection/${colId}`);
check('collection page 200', r.status === 200);
r = await call('b', `/collection/${colId}`);
check('collection page 200 for others', r.status === 200);

// feed shows the collection once and the image inside it not at all
r = await call('b', '/api/feed');
const types = r.data.entries.map((e: any) => `${e.type}:${e.title}`);
console.log(types);
check('collection in feed', types.includes('collection:Trees collection'));
check('collection image hidden from feed', !types.includes('image:one'));

// search
r = await call('b', '/api/feed?q=trees');
check('search finds collection by tag', r.data.entries.some((e: any) => e.type === 'collection'), r.data.entries.map((e: any) => e.title));
r = await call('b', '/api/feed?medium=photography&dimension=2D');
check('filter and across categories', r.data.entries.every((e: any) => e.title !== 'Trees collection') && r.data.entries.length > 0, r.data.entries.map((e: any) => e.title));
r = await call('b', '/api/feed?tag=summer');
check('tag filter finds collection', r.data.entries.length === 1 && r.data.entries[0].type === 'collection', r.data.entries.map((e: any) => e.title));
r = await call('b', '/api/feed?by=seed%20bot');
check('by filter', r.data.entries.length === 2, r.data.entries.map((e: any) => e.title));
r = await call('b', '/api/feed?q=sunset&sort=liked');
check('fts + sort', r.data.entries.length === 1, r.data);

// non-owner can't edit/delete
r = await call('b', `/api/images/${dupId}`, { method: 'DELETE' });
check('non-owner delete refused', r.status === 403, r);
r = await call('b', `/api/images/${dupId}`, { method: 'PATCH', json: { meta: { title: 'x' } } });
check('non-owner edit refused', r.status === 403, r);
// owner edit
r = await call('a', `/api/images/${dupId}`, { method: 'PATCH', json: { meta: { title: 'Renamed', tags: ['zzz'] } } });
check('owner edit', r.status === 200, r);
r = await call('b', '/api/feed?tag=zzz');
check('edited tag searchable', r.data.entries.length === 1 && r.data.entries[0].title === 'Renamed', r.data);
// replace files
const nf = await upload(S + 'photo_2026-10-06_10-36-09.jpg');
r = await call('a', `/api/images/${dupId}`, { method: 'PATCH', json: { meta: { title: 'Renamed' }, pair: { mode: 'single_file', left: nf }, confirm: true } });
check('replace files', r.status === 200, r);

// like
r = await call('b', '/api/like', { json: { type: 'image', id: dupId } });
check('like', r.data.liked === true && r.data.count === 1, r);
r = await call('b', '/api/like', { json: { type: 'image', id: dupId } });
check('unlike', r.data.liked === false && r.data.count === 0, r);
r = await call('b', '/api/like', { json: { type: 'collection', id: colId } });
check('like collection', r.data.count === 1, r);

// delete
r = await call('a', `/api/images/${dupId}`, { method: 'DELETE' });
check('owner delete', r.status === 200, r);
r = await call('b', `/image/${dupId}`);
check('deleted page 404', r.status === 404, r.status);
r = await call('a', `/image/${dupId}`);
check('deleted page 404 for owner', r.status === 404, r.status);
const detail = await call('a', `/collection/${colId}`);
// Arrows to neighbouring entries come first in the page; the grid of this collection's pairs is last.
const imgIds = [...detail.data.matchAll(/href="\/image\/([A-Za-z0-9]{10})"/g)].map((m) => m[1]);
r = await call('a', `/api/images/${imgIds.at(-1)}`, { method: 'DELETE' });
check('last image deletion removes collection', r.status === 200);
r = await call('b', `/collection/${colId}`);
check('collection 404 after last image deleted', r.status === 404, r.status);

// private submissions
const pf = await upload(S + 'photo_2026-09-17_16-16-29.jpg');
r = await call('a', '/api/images', {
	json: { meta: { title: 'QA private', private: true, tags: ['secrettag'] }, pair: { mode: 'single_file', left: pf }, confirm: true }
});
const privId = r.data.id;
check('private upload', r.status === 200 && !!privId, r);
r = await call('a', `/image/${privId}`);
check('owner sees private page', r.status === 200 && r.data.includes('Only you and site admins'), r.status);
r = await call('b', `/image/${privId}`);
check('others get 404 for private page', r.status === 404, r.status);
r = await call('b', '/api/feed?q=private');
check('private not in search', r.data.entries.length === 0, r.data);
r = await call('b', '/api/feed');
check('private not in feed', !r.data.entries.some((e: any) => e.id === privId));
r = await call('b', '/api/tags?q=secret');
check('private tag not suggested', r.data.length === 0, r.data);
const privThumb = /\/files\/(img\/[^"'\s]*-file\.[a-z]+)/.exec((await call('a', `/image/${privId}`)).data)?.[1];
r = await fetch(`${base}/files/${privThumb}`, { headers: { cookie: jars.b } });
check('private file 404 for others', r.status === 404, r.status);
r = await fetch(`${base}/files/${privThumb}`, { headers: { cookie: jars.a } });
check('private file ok for owner', r.status === 200, r.status);
r = await call('b', '/api/like', { json: { type: 'image', id: privId } });
check('private not likeable', r.status === 404, r);

// publishing it makes it public; hiding it again removes it
r = await call('a', `/api/images/${privId}`, { method: 'PATCH', json: { meta: { title: 'QA private', private: false } } });
r = await call('b', `/image/${privId}`);
check('made public', r.status === 200, r.status);
r = await call('a', `/api/images/${privId}`, { method: 'PATCH', json: { meta: { title: 'QA private', private: true } } });
r = await call('b', `/image/${privId}`);
check('made private again', r.status === 404, r.status);

// private collection hides its pairs
const q1 = await upload(S + 'photo_2026-10-06_10-36-09.jpg');
const q2 = await upload(S + 'photo_2026-10-06_10-36-09 (2).jpg');
r = await call('a', '/api/collections', {
	json: { collection: { title: 'QA private set', private: true }, items: [{ meta: { title: 'inner' }, pair: { mode: 'two_files', left: q1, right: q2 } }], confirm: true }
});
const pcol = r.data.id;
const inner = [...(await call('a', `/collection/${pcol}`)).data.matchAll(/href="\/image\/([A-Za-z0-9]{10})"/g)].map((m) => m[1]).at(-1);
r = await call('b', `/collection/${pcol}`);
check('private collection 404 for others', r.status === 404, r.status);
r = await call('b', `/image/${inner}`);
check('pair of private collection 404 for others', r.status === 404, r.status);
r = await call('b', '/api/feed');
check('private collection not in feed', !r.data.entries.some((e: any) => e.id === pcol));
r = await call('a', `/api/collections/${pcol}`, { method: 'PATCH', json: { meta: { title: 'QA private set', private: false } } });
r = await call('b', `/image/${inner}`);
check('publishing the collection publishes its pairs', r.status === 200, r.status);
await call('a', `/api/collections/${pcol}`, { method: 'DELETE' });
await call('a', `/api/images/${privId}`, { method: 'DELETE' });

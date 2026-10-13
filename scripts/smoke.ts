import { readFile } from 'node:fs/promises';
import { files, prepareSamples } from './sample-files';

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

async function upload(file: string, type = 'image/png') {
	const bytes = await readFile(file);
	const p = await call('a', '/api/upload/presign', { json: { files: [{ type, size: bytes.length }] } });
	const { id, url } = p.data.uploads[0];
	await fetch(base + url, { method: 'PUT', headers: { 'content-type': type }, body: bytes });
	return id as string;
}
await prepareSamples();
const check = (name: string, ok: boolean, extra?: unknown) =>
	console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : JSON.stringify(extra));

// duplicate of the seeded single file
let single = await upload(files.single);
let r = await call('a', '/api/images', { json: { meta: { title: 'Dup' }, pair: { mode: 'single_file', left: single } } });
check('duplicate detected', !!r.data.duplicate, r);
r = await call('a', '/api/images', { json: { meta: { title: 'Dup' }, pair: { mode: 'single_file', left: single }, confirm: true } });
check('submit anyway', r.status === 200 && !!r.data.id, r);
const dupId = r.data.id;

// the same two files uploaded as two files duplicates the existing two-file pair
const l = await upload(files.left);
const rr = await upload(files.right);
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
const c1 = await upload(files.left);
const c2 = await upload(files.right);
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
r = await call('b', '/api/feed?q=mirrored&sort=liked');
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
const nf = await upload(files.left);
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
const pf = await upload(files.single);
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
const q1 = await upload(files.left);
const q2 = await upload(files.right);
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

// date: defaults to the posting day, can be custom, never changes feed order
const today = new Date().toISOString().slice(0, 10);
const d1 = await upload(files.single);
r = await call('a', '/api/images', { json: { meta: { title: 'QA dated old', date: '2019-05-01' }, pair: { mode: 'single_file', left: d1 }, confirm: true } });
const oldId = r.data.id;
const d2 = await upload(files.single);
r = await call('a', '/api/images', { json: { meta: { title: 'QA dated default', date: '' }, pair: { mode: 'single_file', left: d2 }, confirm: true } });
const defId = r.data.id;
r = await call('b', `/image/${oldId}`);
check('custom date shown', r.data.includes('1 May 2019'), r.status);
r = await call('b', `/image/${defId}`);
const todayText = new Date(today + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
check('default date is the posting day', r.data.includes(todayText), todayText);
r = await call('b', '/api/feed');
const titles = r.data.entries.map((e: any) => e.title);
check('newest still follows posting order', titles.indexOf('QA dated default') < titles.indexOf('QA dated old'), titles);
r = await call('a', '/api/images', { json: { meta: { title: 'QA future', date: '2999-01-01' }, pair: { mode: 'single_file', left: d1 }, confirm: true } });
check('future date rejected', r.status === 400 && !!r.data.errors?.date, r);
await call('a', `/api/images/${oldId}`, { method: 'DELETE' });
await call('a', `/api/images/${defId}`, { method: 'DELETE' });

// same picture in different colours is not a duplicate; the same colours are
const brown = await upload(files.left);
r = await call('a', '/api/images', { json: { meta: { title: 'QA brown' }, pair: { mode: 'single_file', left: brown }, confirm: true } });
const brownId = r.data.id;
const green = await upload(files.right);
r = await call('a', '/api/images', { json: { meta: { title: 'QA green' }, pair: { mode: 'single_file', left: green } } });
check('different colours: not a duplicate', r.status === 200 && !r.data.duplicate, r);
const greenId = r.data.id;
const brown2 = await upload(files.left);
r = await call('a', '/api/images', { json: { meta: { title: 'QA brown again' }, pair: { mode: 'single_file', left: brown2 } } });
check('same colours: duplicate', !!r.data.duplicate, r);
await call('a', `/api/images/${brownId}`, { method: 'DELETE' });
await call('a', `/api/images/${greenId}`, { method: 'DELETE' });

// opening a recovery link merges the browser's own submissions into the linked owner
r = await call('b', '/api/feed');
const target = r.data.entries[0];
const likesBefore = target.likeCount;
const mA = await upload(files.left);
r = await call('a', '/api/images', { json: { meta: { title: 'QA claim A' }, pair: { mode: 'single_file', left: mA }, confirm: true } });
const claimA = r.data.id;
const mB = await upload(files.right);
r = await call('b', '/api/images', { json: { meta: { title: 'QA claim B' }, pair: { mode: 'single_file', left: mB }, confirm: true } });
const claimB = r.data.id;
await call('a', '/api/like', { json: { type: target.type, id: target.id } });
await call('b', '/api/like', { json: { type: target.type, id: target.id } });
const oldCookieA = jars.a;
const keyB = jars.b.split('=')[1];
r = await call('a', '/api/claim', { json: { key: keyB } });
check('claim asks for confirmation when the browser has its own submissions', r.status === 409 && r.data.needsConfirm, r);
r = await call('a', '/api/claim', { json: { key: keyB, merge: true } });
check('claim with merge succeeds', r.status === 200, r);
r = await call('a', '/me');
check('merged: both images now under one owner', r.data.includes('QA claim A') && r.data.includes('QA claim B'));
r = await call('b', '/me');
check('the linked owner sees both too', r.data.includes('QA claim A') && r.data.includes('QA claim B'));
const keepA = jars.a;
jars.a = oldCookieA;
r = await call('a', '/me');
check('the old key still works and resolves to the merged owner', r.data.includes('QA claim A') && r.data.includes('QA claim B'));
jars.a = keepA;
r = await call('b', '/api/feed');
const after = r.data.entries.find((e: any) => e.id === target.id);
check('likes on the same target counted once after merge', after.likeCount === likesBefore + 1, { likesBefore, now: after.likeCount });
r = await call('a', `/api/images/${claimA}`, { method: 'DELETE' });
check('merged owner can edit the images that came from the other', r.status === 200, r);
r = await call('b', `/api/images/${claimB}`, { method: 'DELETE' });
await call('b', '/api/like', { json: { type: target.type, id: target.id } });

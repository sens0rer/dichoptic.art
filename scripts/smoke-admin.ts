// Needs the dev server started with MODERATION=on, FLAG_THRESHOLD=2, PAUSE_THRESHOLD=4 and
// SITE_PAUSE_THRESHOLD=1000 (see README). Exercises moderation and abuse limits.
import { readFile } from 'node:fs/promises';
import { files, prepareSamples } from './sample-files';

const base = 'http://localhost:5173';
const token = process.env.ADMIN_TOKEN ?? 'change-me-dev-admin';
const jars = { a: '', b: '', admin: '' };

async function call(who: keyof typeof jars, path: string, init: any = {}) {
	const res = await fetch(base + path, {
		method: init.method ?? (init.json || init.form ? 'POST' : 'GET'),
		redirect: 'manual',
		headers: {
			'x-consent': 'accepted',
			origin: base,
			cookie: jars[who],
			...(init.json ? { 'content-type': 'application/json' } : {}),
			...(init.form ? { 'content-type': 'application/x-www-form-urlencoded' } : {})
		},
		body: init.json ? JSON.stringify(init.json) : init.form ? new URLSearchParams(init.form).toString() : undefined
	});
	const jar = res.headers
		.getSetCookie()
		.map((c) => c.split(';')[0])
		.filter(Boolean);
	if (jar.length) jars[who] = [jars[who], ...jar].filter(Boolean).join('; ');
	const text = await res.text();
	let data: any = text;
	try {
		data = JSON.parse(text);
	} catch {}
	return { status: res.status, data };
}

async function upload(file: string) {
	const bytes = await readFile(file);
	const p = await call('a', '/api/upload/presign', { json: { files: [{ type: 'image/png', size: bytes.length }] } });
	if (p.status !== 200) return { error: p };
	const { id, url } = p.data.uploads[0];
	await fetch(base + url, { method: 'PUT', headers: { 'content-type': 'image/png' }, body: bytes });
	return { id: id as string };
}
const check = (name: string, ok: boolean, extra?: unknown) =>
	console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : JSON.stringify(extra));

await prepareSamples();
let up = await upload(files.single);
let r = await call('a', '/api/images', {
	json: { meta: { title: 'Pending one' }, pair: { mode: 'single_file', left: (up as any).id }, confirm: true }
});
check('submit while moderated', r.status === 200, r);
const id = r.data.id;

r = await call('b', `/image/${id}`);
check('pending hidden from others', r.status === 404, r.status);
r = await call('a', `/image/${id}`);
check('pending visible to owner', r.status === 200, r.status);
r = await call('b', '/api/feed');
check('pending not in feed', !r.data.entries.some((e: any) => e.id === id));
r = await call('b', `/files/img/${id}/x-1.jpg`);

r = await call('admin', '/admin?/login', { form: { token: 'wrong' } });
check('wrong admin token', !r.data.toString().includes('"type":"success"'), r.data);
r = await call('admin', '/admin?/login', { form: { token } });
check('admin login', r.status === 200 && r.data.type === 'success', r);
r = await call('admin', '/admin');
check('queue lists the pending pair', r.data.includes('Pending one'));
r = await call('b', '/admin');
check('queue hidden without login', !r.data.includes('Pending one'));

r = await call('admin', '/admin?/approve', { form: { type: 'image', id } });
check('approve', r.status === 200, r);
r = await call('b', '/api/feed');
check('approved shows in feed', r.data.entries.some((e: any) => e.id === id));

// abuse limits: flag above 2, pause above 4
let paused = false;
for (let i = 0; i < 6 && !paused; i++) {
	up = await upload(files.single);
	if ('error' in up) {
		paused = up.error.status === 503;
		break;
	}
	r = await call('a', '/api/images', {
		json: { meta: { title: `Spam ${i}` }, pair: { mode: 'single_file', left: up.id }, confirm: true }
	});
}
r = await call('a', '/api/upload/presign', { json: { files: [{ type: 'image/png', size: 10 }] } });
check('paused after threshold', r.status === 503 && r.data.paused, r);
r = await call('b', '/api/feed');
check('browsing works while paused', r.status === 200);
r = await call('admin', '/admin');
check('flagged listed', r.data.includes('Flagged') && r.data.includes('submissions in 24 h'));
r = await call('admin', '/admin');
check('flagged client lists what it submitted', /recent[\s\S]*Spam \d/.test(r.data.split('Moderation queue')[0]), r.data.slice(0, 100));
r = await call('admin', '/admin?/resume', { form: {} });
r = await call('a', '/api/upload/presign', { json: { files: [{ type: 'image/png', size: 10 }] } });
check('resumed', r.status === 200, r);

// reject path
up = await upload(files.left);
r = await call('a', '/api/images', {
	json: { meta: { title: 'To reject' }, pair: { mode: 'single_file', left: (up as any).id }, confirm: true }
});
const rid = r.data.id;
r = await call('admin', '/admin?/reject', { form: { type: 'image', id: rid, reason: 'nope' } });
r = await call('a', '/me');
check('owner sees rejection', r.data.includes('nope') || r.data.includes('rejected'));


// admins can open private items; others cannot
up = await upload(files.left);
r = await call('a', '/api/images', {
	json: { meta: { title: 'QA admin private', private: true }, pair: { mode: 'single_file', left: (up as any).id }, confirm: true }
});
const privId = r.data.id;
r = await call('b', `/image/${privId}`);
check('private hidden from others', r.status === 404, r.status);
r = await call('admin', `/image/${privId}`);
check('private visible to admin', r.status === 200, r.status);
r = await call('admin', '/admin');
check('private listed for admin, not queued', r.data.includes('QA admin private'));

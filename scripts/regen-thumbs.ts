// Rebuilds every image's thumbnails from its stored originals, at the current quality settings.
// New files get new names (so browser and CDN caches cannot serve the old ones); the old thumbnails are
// deleted afterwards. Safe to re-run. Uses DATABASE_URL, and R2 when STORAGE=r2 (with the R2_* variables),
// otherwise the local upload folder.
import 'dotenv/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import postgres from 'postgres';
import { newFileId } from '../src/lib/server/ids';
import { makeThumbs, prepare } from '../src/lib/server/process';
import { THUMB_WIDTHS } from '../src/lib/vocab';

interface Files {
	get(key: string): Promise<Buffer>;
	put(key: string, data: Buffer): Promise<void>;
	remove(key: string): Promise<void>;
}

function files(): Files {
	if (process.env.STORAGE === 'r2') {
		const need = (n: string) => process.env[n] ?? (() => { throw new Error(`${n} must be set`); })();
		const s3 = new S3Client({
			region: 'auto',
			endpoint: `https://${need('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
			credentials: { accessKeyId: need('R2_ACCESS_KEY_ID'), secretAccessKey: need('R2_SECRET_ACCESS_KEY') }
		});
		const Bucket = need('R2_BUCKET');
		return {
			async get(Key) {
				const r = await s3.send(new GetObjectCommand({ Bucket, Key }));
				return Buffer.from(await r.Body!.transformToByteArray());
			},
			async put(Key, Body) {
				await s3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType: 'image/webp' }));
			},
			async remove(Key) {
				await s3.send(new DeleteObjectCommand({ Bucket, Key }));
			}
		};
	}
	const root = resolve(process.env.UPLOAD_DIR ?? 'data/uploads');
	return {
		get: (key) => readFile(join(root, key)),
		async put(key, data) {
			await mkdir(dirname(join(root, key)), { recursive: true });
			await writeFile(join(root, key), data);
		},
		remove: (key) => rm(join(root, key), { force: true })
	};
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const store = files();

const rows = await sql<
	{ id: string; source_mode: 'single_file' | 'two_files'; file_key: string | null; left_key: string | null; right_key: string | null; thumb_prefix: string }[]
>`SELECT id, source_mode, file_key, left_key, right_key, thumb_prefix FROM images ORDER BY created_at`;

let done = 0;
for (const r of rows) {
	const left = await store.get((r.file_key ?? r.left_key)!);
	const right = r.right_key ? await store.get(r.right_key) : undefined;
	const prepared = await prepare(r.source_mode, { left, right });
	const thumbs = await makeThumbs(prepared.pair);
	const prefix = `img/${r.id}/${newFileId()}`;
	for (const t of thumbs) await store.put(`${prefix}-${t.width}.webp`, t.data);
	const bytes = left.length + (right?.length ?? 0) + thumbs.reduce((n, t) => n + t.data.length, 0);
	const last = thumbs[thumbs.length - 1];
	await sql`UPDATE images SET thumb_prefix = ${prefix}, thumb_w = ${last.w}, thumb_h = ${last.h}, bytes = ${bytes} WHERE id = ${r.id}`;
	for (const w of THUMB_WIDTHS) await store.remove(`${r.thumb_prefix}-${w}.webp`);
	done++;
	console.log(`${done}/${rows.length} ${r.id}`);
}
await sql.end();
console.log(`rebuilt thumbnails for ${done} images`);

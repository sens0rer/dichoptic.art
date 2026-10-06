import { and, eq, gt, sql } from 'drizzle-orm';
import { config } from './config';
import { db, images, uploadLog } from './db';

const DAY_MS = 24 * 60 * 60 * 1000;

export class QuotaError extends Error {}

export async function storageUsed(): Promise<number> {
	const [row] = await db.select({ n: sql<number>`coalesce(sum(${images.bytes}), 0)::float8` }).from(images);
	return row.n;
}

// Called before handing out upload URLs. Stored files are capped in total, and the bytes a client
// (or the whole site) may upload per day are capped too, since unsubmitted tmp/ files also take space.
export async function reserveUpload(ip: string, sizes: number[]) {
	const asked = sizes.reduce((a, b) => a + b, 0);
	if ((await storageUsed()) + asked > config.storageLimitBytes)
		throw new QuotaError('Uploads are closed: the site has reached its storage limit.');

	const since = new Date(Date.now() - DAY_MS);
	const [mine] = await db
		.select({ n: sql<number>`coalesce(sum(${uploadLog.bytes}), 0)::float8` })
		.from(uploadLog)
		.where(and(eq(uploadLog.clientIp, ip), gt(uploadLog.createdAt, since)));
	if (mine.n + asked > config.uploadBytesPerIpDay)
		throw new QuotaError('You have reached the daily upload limit. Try again tomorrow.');
	const [site] = await db
		.select({ n: sql<number>`coalesce(sum(${uploadLog.bytes}), 0)::float8` })
		.from(uploadLog)
		.where(gt(uploadLog.createdAt, since));
	if (site.n + asked > config.uploadBytesSiteDay)
		throw new QuotaError('The site has reached its daily upload limit. Try again tomorrow.');

	await db.insert(uploadLog).values(sizes.map((bytes) => ({ clientIp: ip, bytes })));
}

import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { config } from './config';
import { collections, db, images, siteState, submissionLog } from './db';

const DAY_MS = 24 * 60 * 60 * 1000;

export class PausedError extends Error {
	constructor() {
		super('Submissions are paused. Browsing, search and likes still work.');
	}
}

export async function isPaused(): Promise<boolean> {
	const [row] = await db.select().from(siteState).where(eq(siteState.key, 'paused'));
	return !!row;
}

export async function assertNotPaused() {
	if (await isPaused()) throw new PausedError();
}

const since = () => new Date(Date.now() - DAY_MS);

export interface Submitted {
	type: 'image' | 'collection';
	id: string;
}

// Logs submissions (each image or collection counts once) and trips the flag / pause thresholds.
export async function recordSubmissions(ip: string, submitted: Submitted[]) {
	await db
		.insert(submissionLog)
		.values(submitted.map((s) => ({ clientIp: ip, targetType: s.type, targetId: s.id })));
	const [{ mine }] = await db
		.select({ mine: sql<number>`count(*)::int` })
		.from(submissionLog)
		.where(and(eq(submissionLog.clientIp, ip), gt(submissionLog.createdAt, since())));
	const [{ site }] = await db
		.select({ site: sql<number>`count(*)::int` })
		.from(submissionLog)
		.where(gt(submissionLog.createdAt, since()));

	if (mine > config.flagThreshold) {
		await db
			.insert(siteState)
			.values({ key: `flagged:${ip}`, value: { since: new Date().toISOString() } })
			.onConflictDoNothing();
	}
	if (mine > config.pauseThreshold || site > config.sitePauseThreshold) {
		await db
			.insert(siteState)
			.values({
				key: 'paused',
				value: { since: new Date().toISOString(), reason: mine > config.pauseThreshold ? ip : 'site' }
			})
			.onConflictDoNothing();
	}
}

export async function flaggedClients() {
	const rows = await db
		.select()
		.from(siteState)
		.where(sql`${siteState.key} LIKE 'flagged:%'`);
	return Promise.all(
		rows.map(async (r) => {
			const ip = r.key.slice('flagged:'.length);
			const log = await db
				.select()
				.from(submissionLog)
				.where(and(eq(submissionLog.clientIp, ip), gt(submissionLog.createdAt, since())))
				.orderBy(desc(submissionLog.createdAt));
			const ids = (type: 'image' | 'collection') =>
				log.filter((l) => l.targetType === type).map((l) => l.targetId);
			const [imgs, cols] = await Promise.all([
				ids('image').length
					? db.select({ id: images.id, title: images.title }).from(images).where(inArray(images.id, ids('image')))
					: [],
				ids('collection').length
					? db
							.select({ id: collections.id, title: collections.title })
							.from(collections)
							.where(inArray(collections.id, ids('collection')))
					: []
			]);
			const titles = new Map([...imgs, ...cols].map((t) => [t.id, t.title]));
			return {
				ip,
				since: (r.value as { since: string }).since,
				last24h: log.length,
				recent: log.slice(0, 15).map((l) => ({
					type: l.targetType,
					id: l.targetId,
					title: titles.get(l.targetId) ?? null,
					at: l.createdAt.toISOString()
				}))
			};
		})
	);
}

export const clearFlag = (ip: string) =>
	db.delete(siteState).where(eq(siteState.key, `flagged:${ip}`));

export async function pause(reason: string) {
	await db
		.insert(siteState)
		.values({ key: 'paused', value: { since: new Date().toISOString(), reason } })
		.onConflictDoNothing();
}

// Resuming also restarts the counting window, otherwise the next submission would pause again.
export async function resume() {
	await db.delete(siteState).where(eq(siteState.key, 'paused'));
	await db.delete(submissionLog).where(gt(submissionLog.createdAt, since()));
}

export async function pausedInfo() {
	const [row] = await db.select().from(siteState).where(eq(siteState.key, 'paused'));
	return row ? (row.value as { since: string; reason: string }) : null;
}

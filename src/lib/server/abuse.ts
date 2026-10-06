import { and, eq, gt, sql } from 'drizzle-orm';
import { config } from './config';
import { db, siteState, submissionLog } from './db';

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

// Logs one submission (an image or a collection) and trips the flag / pause thresholds.
export async function recordSubmissions(ip: string, count = 1) {
	await db.insert(submissionLog).values(Array.from({ length: count }, () => ({ clientIp: ip })));
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
			const [{ n }] = await db
				.select({ n: sql<number>`count(*)::int` })
				.from(submissionLog)
				.where(and(eq(submissionLog.clientIp, ip), gt(submissionLog.createdAt, since())));
			return { ip, since: (r.value as { since: string }).since, last24h: n };
		})
	);
}

export const clearFlag = (ip: string) =>
	db.delete(siteState).where(eq(siteState.key, `flagged:${ip}`));

// Resuming also restarts the counting window, otherwise the next submission would pause again.
export async function resume() {
	await db.delete(siteState).where(eq(siteState.key, 'paused'));
	await db.delete(submissionLog).where(gt(submissionLog.createdAt, since()));
}

export async function pausedInfo() {
	const [row] = await db.select().from(siteState).where(eq(siteState.key, 'paused'));
	return row ? (row.value as { since: string; reason: string }) : null;
}

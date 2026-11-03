import type { Cookies } from '@sveltejs/kit';
import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { allCovered, parse, type Span, type UnitKind } from '../synesthesia/segment';
import { db, synAnswers, synAttempts, synParticipants, synSessions, synStimuli } from './db';
import { newFileId, newId } from './ids';

// Identifies the browser, so answers from anyone else who opens the link can be filtered out
// later. Scoped to the test pages; the main site never sees it.
const COOKIE = 'syn_participant';

export async function participant(cookies: Cookies): Promise<string> {
	let id = cookies.get(COOKIE);
	if (!id || !/^[A-Za-z0-9]{24}$/.test(id)) id = newFileId();
	// Set before the first await: a page's layout and page loads run in parallel and share these
	// cookies, so the second call must already see the id the first one made.
	cookies.set(COOKIE, id, {
		path: '/synesthesia',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365 * 10
	});
	await db.insert(synParticipants).values({ id }).onConflictDoNothing();
	return id;
}

export const CATEGORIES = [
	{ id: 'texts', name: 'Texts', description: 'Short passages in Ukrainian and English.' }
] as const;
export type CategoryId = (typeof CATEGORIES)[number]['id'];
export const category = (id: string) => CATEGORIES.find((c) => c.id === id);

// The next item she has not started in a category. The order is random but fixed per browser:
// sorting by a hash of participant + item gives every browser its own shuffle.
export async function startNext(pid: string, cat: CategoryId): Promise<string | null> {
	const [next] = await db
		.select({ id: synStimuli.id })
		.from(synStimuli)
		.where(
			and(
				eq(synStimuli.category, cat),
				eq(synStimuli.hidden, false),
				sql`NOT EXISTS (SELECT 1 FROM ${synAttempts} a WHERE a.stimulus_id = ${synStimuli.id} AND a.participant_id = ${pid})`
			)
		)
		.orderBy(sql`md5(${pid} || ${synStimuli.id})`)
		.limit(1);
	if (!next) return null;
	const id = newId();
	await db.insert(synAttempts).values({ id, participantId: pid, stimulusId: next.id });
	return id;
}

export async function getAttempt(pid: string, id: string) {
	const [row] = await db
		.select({ attempt: synAttempts, stimulus: synStimuli })
		.from(synAttempts)
		.innerJoin(synStimuli, eq(synStimuli.id, synAttempts.stimulusId))
		.where(and(eq(synAttempts.id, id), eq(synAttempts.participantId, pid)));
	return row ?? null;
}

// The answers still in force: everything not undone. Colours are left out on purpose: while she
// is marking an item, the page only learns which parts are done, never what colour they were.
export async function activeAnswers(attemptId: string) {
	const rows = await db
		.select({
			clientId: synAnswers.clientId,
			kind: synAnswers.kind,
			start: synAnswers.start,
			end: synAnswers.end,
			supersedes: synAnswers.supersedes,
			note: synAnswers.note
		})
		.from(synAnswers)
		.where(eq(synAnswers.attemptId, attemptId))
		.orderBy(asc(synAnswers.id));
	const undone = new Set(rows.filter((r) => r.kind === 'retract').map((r) => r.supersedes));
	return rows
		.filter((r) => r.kind !== 'retract' && !undone.has(r.clientId))
		.map((r) => ({ clientId: r.clientId, kind: r.kind as 'colour' | 'none' | 'note', start: r.start!, end: r.end!, hasNote: !!r.note }));
}

// An item is finished once every unit is covered by a colour or "no colour" answer. Undoing an
// answer can take it back to unfinished.
export async function refreshFinished(attemptId: string) {
	const row = await db
		.select({ body: synStimuli.body, unit: synStimuli.unit, lang: synStimuli.lang, finishedAt: synAttempts.finishedAt })
		.from(synAttempts)
		.innerJoin(synStimuli, eq(synStimuli.id, synAttempts.stimulusId))
		.where(eq(synAttempts.id, attemptId))
		.then((r) => r[0]);
	if (!row) return false;
	const spans: Span[] = (await activeAnswers(attemptId)).filter((a) => a.kind !== 'note');
	const done = allCovered(parse(row.body, row.unit as UnitKind, row.lang), spans);
	if (done !== !!row.finishedAt)
		await db.update(synAttempts).set({ finishedAt: done ? new Date() : null }).where(eq(synAttempts.id, attemptId));
	return done;
}

export async function recordSession(pid: string, id: string, device: unknown) {
	await db.insert(synSessions).values({ id, participantId: pid, device }).onConflictDoNothing();
}

export async function counts(pid: string) {
	const rows = await db.execute<{ category: string; total: number; finished: number; unfinished: number }>(sql`
		SELECT s.category,
			count(*) FILTER (WHERE NOT s.hidden)::int AS total,
			count(a.id) FILTER (WHERE a.finished_at IS NOT NULL)::int AS finished,
			count(a.id) FILTER (WHERE a.finished_at IS NULL)::int AS unfinished
		FROM syn_stimuli s
		LEFT JOIN syn_attempts a ON a.stimulus_id = s.id AND a.participant_id = ${pid} AND NOT a.retest
		GROUP BY s.category`);
	return Object.fromEntries(rows.map((r) => [r.category, r]));
}

export async function attemptsList(pid: string, finished: boolean) {
	return db
		.select({
			id: synAttempts.id,
			category: synStimuli.category,
			title: synStimuli.title,
			body: synStimuli.body,
			createdAt: synAttempts.createdAt,
			finishedAt: synAttempts.finishedAt
		})
		.from(synAttempts)
		.innerJoin(synStimuli, eq(synStimuli.id, synAttempts.stimulusId))
		.where(
			and(
				eq(synAttempts.participantId, pid),
				finished ? isNotNull(synAttempts.finishedAt) : isNull(synAttempts.finishedAt)
			)
		)
		.orderBy(desc(synAttempts.createdAt));
}

export interface Position {
	attemptId: string;
	scroll: number;
	selection: Span | null;
}

export async function getPosition(pid: string): Promise<Position | null> {
	const [row] = await db.select({ position: synParticipants.position }).from(synParticipants).where(eq(synParticipants.id, pid));
	const p = row?.position as Position | null;
	if (!p) return null;
	// Only offer to continue into an item that still exists and is still open.
	const a = await getAttempt(pid, p.attemptId);
	return a && !a.attempt.finishedAt ? p : null;
}

export const setPosition = (pid: string, position: Position | null) =>
	db.update(synParticipants).set({ position }).where(eq(synParticipants.id, pid));

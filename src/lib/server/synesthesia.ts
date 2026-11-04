import type { Cookies } from '@sveltejs/kit';
import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { allCovered, parse, type Span, type UnitKind } from '../synesthesia/segment';
import { db, synAnswers, synAttempts, synParticipants, synResultViews, synReverse, synSessions, synStimuli } from './db';
import { newFileId, newId } from './ids';
import { stimulusId } from '../synesthesia/stimulus';

// Identifies the browser, so answers from anyone else who opens the link can be filtered out
// later. Scoped to the test pages; the main site never sees it.
const COOKIE = 'syn_participant';

export async function participant(cookies: Cookies): Promise<string> {
	let id = cookies.get(COOKIE);
	if (!id || !/^[A-Za-z0-9]{24}$/.test(id)) id = newFileId();
	// A page's layout and page loads run in parallel and share these cookies; setting the cookie
	// at once means the second call already sees the id the first one made.
	cookies.set(COOKIE, id, {
		path: '/synesthesia',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365 * 10
	});
	return id;
}

// A browser becomes a participant (a row in syn_participants) with its first answer; visiting
// pages or starting items records nothing about it.
export const enrol = (pid: string) => db.insert(synParticipants).values({ id: pid }).onConflictDoNothing();

// "items" categories hand out items from their own pool; Retests re-serves finished items from
// any category; the reverse test has a page of its own. A hidden category is off the home page but
// stays in results and admin, so earlier answers keep their place (Songs' items are also hidden).
export const CATEGORIES = [
	{ id: 'texts', kind: 'items', name: 'Texts', description: 'Short passages in Ukrainian and English.' },
	{ id: 'parallel', kind: 'items', name: 'Parallel texts', description: 'The same passage in Ukrainian and in English.' },
	{ id: 'terminology', kind: 'items', name: 'Terminology', description: 'Passages on specialist subjects, in Ukrainian and English.' },
	{ id: 'words', kind: 'items', name: 'Separate words', description: 'Ukrainian and English words without context, from very common to rare.' },
	{ id: 'pseudowords', kind: 'items', name: 'Made-up words', description: 'English-looking words that do not exist.' },
	{ id: 'colourwords', kind: 'items', name: 'Colour words', description: 'Colour names, and things that usually have a colour.' },
	{ id: 'similar', kind: 'items', name: 'Related languages', description: 'Latin, French, German, Belarusian and Polish.' },
	{ id: 'dissimilar', kind: 'items', name: 'Distant languages', description: 'Arabic, Korean, Japanese, Chinese, Thai and Hebrew.' },
	{ id: 'alphabets', kind: 'items', name: 'Alphabets', description: 'Letters of English, Ukrainian, Greek and the distant languages.' },
	{ id: 'numbers', kind: 'items', name: 'Numbers', description: 'Digits, longer numbers and number words.' },
	{ id: 'time', kind: 'items', name: 'Time', description: 'Weekdays, months, seasons, times of day, dates and clock times.' },
	{ id: 'maths', kind: 'items', name: 'Maths', description: 'School maths, from arithmetic to simple calculus.' },
	{ id: 'lyrics', kind: 'items', name: 'Songs', description: 'Well-known Ukrainian and English songs, as words.', hidden: true },
	{ id: 'picks', kind: 'items', name: 'Your songs', description: 'Songs you choose: add one and colour its lyrics.' },
	{ id: 'retests', kind: 'retests', name: 'Retests', description: 'Items you have finished, again, in random order.', hidden: true },
	{ id: 'reverse', kind: 'reverse', name: 'Reverse test', description: 'A colour is shown; write something that has that colour.' }
] as const;
export type CategoryId = (typeof CATEGORIES)[number]['id'];
export const category = (id: string) => CATEGORIES.find((c) => c.id === id);

// Song picks belong to whoever added them; every other pool is shared.
const mine = (pid: string) =>
	sql`(${synStimuli.category} <> 'picks' OR ${synStimuli.source}->>'participant' = ${pid})`;

// Her time zone, from her latest answer, so "today" means her day.
async function timeZone(pid: string) {
	const [row] = await db
		.select({ tz: synAnswers.tz })
		.from(synAnswers)
		.where(and(eq(synAnswers.participantId, pid), isNotNull(synAnswers.tz)))
		.orderBy(desc(synAnswers.id))
		.limit(1);
	return row?.tz ?? 'Europe/Kyiv';
}

// Finished items that can be retested: finished before today (her day), and not already waiting
// as an unfinished retest, and not hidden. Least-retested first, then the ones retested longest ago.
async function retestCandidates(pid: string, limit: number) {
	const tz = await timeZone(pid);
	return db.execute<{ id: string }>(sql`
		SELECT s.id FROM syn_stimuli s
		WHERE NOT s.hidden
			AND EXISTS (
				SELECT 1 FROM syn_attempts f
				WHERE f.stimulus_id = s.id AND f.participant_id = ${pid} AND NOT f.retest
					AND f.finished_at IS NOT NULL
					AND (f.finished_at AT TIME ZONE ${tz})::date < (now() AT TIME ZONE ${tz})::date)
			AND NOT EXISTS (
				SELECT 1 FROM syn_attempts o
				WHERE o.stimulus_id = s.id AND o.participant_id = ${pid} AND o.retest AND o.finished_at IS NULL)
		ORDER BY
			(SELECT count(*) FROM syn_attempts r WHERE r.stimulus_id = s.id AND r.participant_id = ${pid} AND r.retest),
			(SELECT max(r.created_at) FROM syn_attempts r WHERE r.stimulus_id = s.id AND r.participant_id = ${pid} AND r.retest) NULLS FIRST,
			random()
		LIMIT ${limit}`);
}

export const retestsAvailable = async (pid: string) => (await retestCandidates(pid, 100000)).length;

// The next item for a category: in item categories, the next one she has not started, in a random
// order fixed per browser (sorting by a hash of participant + item gives every browser its own
// shuffle); in Retests, the next finished item due again.
export async function startNext(pid: string, cat: CategoryId): Promise<string | null> {
	if (cat === 'retests') {
		const [due] = await retestCandidates(pid, 1);
		if (!due) return null;
		const id = newId();
		await db.insert(synAttempts).values({ id, participantId: pid, stimulusId: due.id, retest: true });
		return id;
	}
	const [next] = await db
		.select({ id: synStimuli.id })
		.from(synStimuli)
		.where(
			and(
				eq(synStimuli.category, cat),
				eq(synStimuli.hidden, false),
				mine(pid),
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
		.map((r) => ({ clientId: r.clientId, kind: r.kind as 'colour' | 'none' | 'note' | 'flag', start: r.start!, end: r.end!, note: r.note }));
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
	const spans: Span[] = (await activeAnswers(attemptId)).filter((a) => a.kind === 'colour' || a.kind === 'none');
	const done = allCovered(parse(row.body, row.unit as UnitKind, row.lang), spans);
	if (done !== !!row.finishedAt)
		await db.update(synAttempts).set({ finishedAt: done ? new Date() : null }).where(eq(synAttempts.id, attemptId));
	return done;
}

// Each delivery carries the device info; the latest wins, so a checklist answered after the first
// answer of a visit still reaches the session.
export async function recordSession(pid: string, id: string, device: unknown) {
	await db
		.insert(synSessions)
		.values({ id, participantId: pid, device })
		.onConflictDoUpdate({ target: synSessions.id, set: { device }, where: eq(synSessions.participantId, pid) });
}

export async function counts(pid: string) {
	const rows = await db.execute<{ category: string; total: number; finished: number; unfinished: number }>(sql`
		SELECT s.category,
			count(*) FILTER (WHERE NOT s.hidden)::int AS total,
			count(a.id) FILTER (WHERE a.finished_at IS NOT NULL)::int AS finished,
			count(a.id) FILTER (WHERE a.finished_at IS NULL)::int AS unfinished
		FROM syn_stimuli s
		LEFT JOIN syn_attempts a ON a.stimulus_id = s.id AND a.participant_id = ${pid} AND NOT a.retest
		WHERE (s.category <> 'picks' OR s.source->>'participant' = ${pid})
		GROUP BY s.category`);
	return Object.fromEntries(rows.map((r) => [r.category, r]));
}

// Answers in force on an attempt, in SQL: colour, "no colour" or note, not undone.
const hasAnswers = sql`EXISTS (
	SELECT 1 FROM syn_answers x WHERE x.attempt_id = ${synAttempts.id} AND x.kind IN ('colour', 'none', 'note')
		AND NOT EXISTS (SELECT 1 FROM syn_answers r WHERE r.attempt_id = x.attempt_id AND r.kind = 'retract' AND r.supersedes = x.client_id))`;

// A participant's attempts: finished; unfinished and still offered (hidden items are out of rounds);
// or started, meaning unfinished with at least one answer, hidden or not (Results shows these).
export async function attemptsList(pid: string, which: 'finished' | 'unfinished' | 'started') {
	return db
		.select({
			id: synAttempts.id,
			stimulusId: synAttempts.stimulusId,
			category: synStimuli.category,
			title: synStimuli.title,
			body: synStimuli.body,
			retest: synAttempts.retest,
			createdAt: synAttempts.createdAt,
			finishedAt: synAttempts.finishedAt
		})
		.from(synAttempts)
		.innerJoin(synStimuli, eq(synStimuli.id, synAttempts.stimulusId))
		.where(
			and(
				eq(synAttempts.participantId, pid),
				which === 'finished' ? isNotNull(synAttempts.finishedAt) : isNull(synAttempts.finishedAt),
				which === 'unfinished' ? eq(synStimuli.hidden, false) : undefined,
				which === 'started' ? hasAnswers : undefined
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

// ---- results ----

export interface ResultAnswer {
	kind: 'colour' | 'none' | 'note';
	start: number;
	end: number;
	hex: string | null;
	lightness: number | null;
	// Further colours, when the answer has more than one.
	more: { hex: string; lightness: number }[];
	note: string | null;
}

// One item with every attempt at it (the first and any retests) that is finished or has answers,
// each with its answers and colours. Opening it is logged.
export async function result(pid: string, attemptId: string) {
	const row = await getAttempt(pid, attemptId);
	if (!row) return null;
	const attempts = await db
		.select({ id: synAttempts.id, retest: synAttempts.retest, finishedAt: synAttempts.finishedAt })
		.from(synAttempts)
		.where(and(eq(synAttempts.participantId, pid), eq(synAttempts.stimulusId, row.stimulus.id)))
		.orderBy(asc(synAttempts.createdAt));
	const withAnswers = [];
	for (const a of attempts) {
		const answers = await answersWithColours(a.id);
		if (a.finishedAt || answers.length) withAnswers.push({ ...a, answers });
	}
	await db.insert(synResultViews).values({ participantId: pid, stimulusId: row.stimulus.id });
	return { stimulus: row.stimulus, attempts: withAnswers };
}

// An attempt's answers in force (undos applied), with their colours: what Results draws. Flags
// ("I know this song") cover no text and are left out.
export async function answersWithColours(attemptId: string): Promise<ResultAnswer[]> {
	const rows = await db.select().from(synAnswers).where(eq(synAnswers.attemptId, attemptId)).orderBy(asc(synAnswers.id));
	const undone = new Set(rows.filter((r) => r.kind === 'retract').map((r) => r.supersedes));
	return rows
		.filter((r) => (r.kind === 'colour' || r.kind === 'none' || r.kind === 'note') && !undone.has(r.clientId))
		.map((r) => {
			const c = r.colour as { hex: string; l: number; more?: { hex: string; l: number }[] } | null;
			return {
				kind: r.kind as ResultAnswer['kind'],
				start: r.start!,
				end: r.end!,
				hex: c?.hex ?? null,
				lightness: c?.l ?? null,
				more: (c?.more ?? []).map((m) => ({ hex: m.hex, lightness: m.l })),
				note: r.note
			};
		});
}

// ---- your songs ----

// Adds a song excerpt she chose as an item of her own and starts it.
export async function addPick(
	pid: string,
	song: { artist: string; track: string; excerpt: string; lang: string; lrclibId: number | null }
) {
	const row = {
		category: 'picks',
		unit: 'word' as const,
		lang: song.lang,
		title: `${song.artist} — ${song.track}`,
		body: song.excerpt
	};
	const id = stimulusId({ ...row, owner: pid });
	await db
		.insert(synStimuli)
		.values({ id, ...row, source: { from: song.lrclibId ? 'lrclib' : 'pasted', participant: pid, lrclibId: song.lrclibId } })
		.onConflictDoNothing();
	// The same excerpt added twice opens the attempt already made for it.
	const [existing] = await db
		.select({ id: synAttempts.id })
		.from(synAttempts)
		.where(and(eq(synAttempts.participantId, pid), eq(synAttempts.stimulusId, id), eq(synAttempts.retest, false)));
	if (existing) return existing.id;
	const attemptId = newId();
	await db.insert(synAttempts).values({ id: attemptId, participantId: pid, stimulusId: id });
	return attemptId;
}

// ---- reverse test ----

export async function reverseCount(pid: string) {
	const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(synReverse).where(eq(synReverse.participantId, pid));
	return row?.n ?? 0;
}

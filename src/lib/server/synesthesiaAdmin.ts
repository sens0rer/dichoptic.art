import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { deviceLabel } from '../synesthesia/device';
import { db, synAnswers, synAttempts, synParticipants, synReverse, synSessions, synStimuli } from './db';
import { answersWithColours } from './synesthesia';

// What the admin pages show about the pools: items with their source, tags and how much they have
// been used. Usage counts every browser, so test visits are included.

export async function categoryStats() {
	const rows = await db.execute<{ category: string; items: number; hidden: number; attempts: number; answers: number; langs: string | null }>(sql`
		SELECT s.category,
			count(*) FILTER (WHERE NOT s.hidden)::int AS items,
			count(*) FILTER (WHERE s.hidden)::int AS hidden,
			coalesce(sum((SELECT count(*) FROM syn_attempts a WHERE a.stimulus_id = s.id)), 0)::int AS attempts,
			coalesce(sum((SELECT count(*) FROM syn_answers x JOIN syn_attempts a ON a.id = x.attempt_id WHERE a.stimulus_id = s.id AND x.kind IN ('colour', 'none'))), 0)::int AS answers,
			string_agg(DISTINCT s.lang, ', ' ORDER BY s.lang) AS langs
		FROM syn_stimuli s
		GROUP BY s.category`);
	return Object.fromEntries([...rows].map((r) => [r.category, r]));
}

export async function categoryItems(category: string, opts: { lang?: string; hidden?: boolean }) {
	return db
		.select({
			id: synStimuli.id,
			unit: synStimuli.unit,
			lang: synStimuli.lang,
			title: synStimuli.title,
			body: synStimuli.body,
			source: synStimuli.source,
			hidden: synStimuli.hidden,
			createdAt: synStimuli.createdAt,
			attempts: sql<number>`(SELECT count(*)::int FROM syn_attempts a WHERE a.stimulus_id = ${synStimuli.id})`,
			finished: sql<number>`(SELECT count(*)::int FROM syn_attempts a WHERE a.stimulus_id = ${synStimuli.id} AND a.finished_at IS NOT NULL)`
		})
		.from(synStimuli)
		.where(
			and(
				eq(synStimuli.category, category),
				opts.lang ? eq(synStimuli.lang, opts.lang) : undefined,
				opts.hidden ? undefined : eq(synStimuli.hidden, false)
			)
		)
		.orderBy(asc(synStimuli.lang), asc(synStimuli.title), desc(synStimuli.createdAt));
}

export async function item(id: string) {
	const [row] = await db.select().from(synStimuli).where(eq(synStimuli.id, id));
	if (!row) return null;
	const usage = await db.execute<{ participant_id: string; attempts: number; finished: number; retests: number; answers: number; last: string | null }>(sql`
		SELECT a.participant_id,
			count(DISTINCT a.id)::int AS attempts,
			count(DISTINCT a.id) FILTER (WHERE a.finished_at IS NOT NULL)::int AS finished,
			count(DISTINCT a.id) FILTER (WHERE a.retest)::int AS retests,
			count(x.id) FILTER (WHERE x.kind IN ('colour', 'none'))::int AS answers,
			max(x.answered_at) AS last
		FROM syn_attempts a
		LEFT JOIN syn_answers x ON x.attempt_id = a.id
		WHERE a.stimulus_id = ${id}
		GROUP BY a.participant_id
		ORDER BY max(x.answered_at) DESC NULLS LAST`);
	return { item: row, usage: [...usage] };
}

// Every attempt at an item that has answers, from every participant, with answers and colours as
// Results draws them. Viewing them here is not logged (the log is for her own views).
export async function itemResults(stimulusId: string) {
	const attempts = await db
		.select({ id: synAttempts.id, participantId: synAttempts.participantId, retest: synAttempts.retest, createdAt: synAttempts.createdAt, finishedAt: synAttempts.finishedAt })
		.from(synAttempts)
		.where(eq(synAttempts.stimulusId, stimulusId))
		.orderBy(asc(synAttempts.participantId), asc(synAttempts.createdAt));
	const out = [];
	for (const a of attempts) {
		const answers = await answersWithColours(a.id);
		if (!answers.length) continue;
		// The devices the answers were given on.
		const sessions = await db.selectDistinct({ id: synAnswers.sessionId }).from(synAnswers).where(eq(synAnswers.attemptId, a.id));
		const labels = await deviceLabels(sessions.map((s) => s.id));
		out.push({ ...a, answers, devices: [...new Set(labels.values())] });
	}
	return out;
}

// One participant: what they have answered, by item, and their reverse-test answers.
export async function participantSummary(pid: string) {
	const attempts = await db.execute<{ id: string; stimulus_id: string; category: string; title: string | null; body: string; unit: string; retest: boolean; finished_at: string | null; created_at: string; answers: number; sessions: string[] }>(sql`
		SELECT a.id, a.stimulus_id, s.category, s.title, s.body, s.unit, a.retest, a.finished_at, a.created_at,
			(SELECT count(*)::int FROM syn_answers x WHERE x.attempt_id = a.id AND x.kind IN ('colour', 'none')) AS answers,
			ARRAY(SELECT DISTINCT x.session_id FROM syn_answers x WHERE x.attempt_id = a.id) AS sessions
		FROM syn_attempts a JOIN syn_stimuli s ON s.id = a.stimulus_id
		WHERE a.participant_id = ${pid}
		ORDER BY a.created_at DESC`);
	const reverse = await db.select().from(synReverse).where(eq(synReverse.participantId, pid)).orderBy(desc(synReverse.id));
	const [p] = await db.select().from(synParticipants).where(eq(synParticipants.id, pid));
	const sessions = await db.select().from(synSessions).where(eq(synSessions.participantId, pid)).orderBy(asc(synSessions.createdAt));
	// Browsers tied to this participant, and the participants it could be tied to.
	const tied = await db.select({ id: synParticipants.id, record: synParticipants.mergeRecord }).from(synParticipants).where(eq(synParticipants.mergedInto, pid));
	const others = await db.select({ id: synParticipants.id }).from(synParticipants).where(and(ne(synParticipants.id, pid), isNull(synParticipants.mergedInto)));
	return { participant: p ?? null, attempts: [...attempts].filter((a) => a.answers > 0), reverse, sessions, tied, others };
}

// The device of each session, as a short label, for showing which device an answer was given on.
export async function deviceLabels(sessionIds: string[]) {
	if (!sessionIds.length) return new Map<string, string>();
	const rows = await db.select({ id: synSessions.id, device: synSessions.device }).from(synSessions).where(inArray(synSessions.id, sessionIds));
	return new Map(rows.map((r) => [r.id, deviceLabel(r.device)]));
}

// Items never change; hiding only keeps one out of new rounds (answers to it stay).
export const setHidden = (id: string, hidden: boolean) => db.update(synStimuli).set({ hidden }).where(eq(synStimuli.id, id));

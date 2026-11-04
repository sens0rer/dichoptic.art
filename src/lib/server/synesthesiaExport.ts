import { asc, inArray } from 'drizzle-orm';
import { parse, type UnitKind } from '../synesthesia/segment';
import { db, synAnswers, synAttempts, synParticipants, synResultViews, synReverse, synSessions, synStimuli } from './db';

// Everything recorded by the colour tests, for analysis. Answers are kept as recorded (undos are
// their own rows), and each answer also carries the text it covers and its colour values, so the
// CSV can be read without joining tables.

export async function exportAll() {
	const [participants, sessions, attempts, answers, reverse, views] = await Promise.all([
		db.select().from(synParticipants).orderBy(asc(synParticipants.createdAt)),
		db.select().from(synSessions).orderBy(asc(synSessions.createdAt)),
		db.select().from(synAttempts).orderBy(asc(synAttempts.createdAt)),
		db.select().from(synAnswers).orderBy(asc(synAnswers.id)),
		db.select().from(synReverse).orderBy(asc(synReverse.id)),
		db.select().from(synResultViews).orderBy(asc(synResultViews.id))
	]);
	const used = [...new Set(attempts.map((a) => a.stimulusId))];
	const stimuli = used.length ? await db.select().from(synStimuli).where(inArray(synStimuli.id, used)) : [];
	return { exportedAt: new Date().toISOString(), participants, sessions, stimuli, attempts, answers, reverse, resultViews: views };
}

const cell = (v: unknown) => {
	if (v === null || v === undefined) return '';
	const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// Starts with a byte-order mark: without it Excel shows Cyrillic and other scripts as garbage.
export const csv = (header: string[], rows: unknown[][]) =>
	'﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

// The undone answers are flagged rather than dropped: an undo is data too.
export async function answersCsv() {
	const data = await exportAll();
	const stimuli = new Map(data.stimuli.map((s) => [s.id, s]));
	const parsed = new Map(data.stimuli.map((s) => [s.id, parse(s.body, s.unit as UnitKind, s.lang)]));
	const attempts = new Map(data.attempts.map((a) => [a.id, a]));
	const undone = new Set(data.answers.filter((a) => a.kind === 'retract').map((a) => a.supersedes));
	const rows = data.answers.map((a) => {
		const at = attempts.get(a.attemptId)!;
		const s = stimuli.get(at.stimulusId)!;
		const p = parsed.get(at.stimulusId)!;
		type C = { h: number; s: number; l: number; hex: string; lab: [number, number, number] };
		const c = a.colour as (C & { more?: C[] }) | null;
		const more = c?.more ?? [];
		// Further colours, one value per colour, separated by spaces (Oklab as L,a,b).
		const list = (f: (m: C) => unknown) => (more.length ? more.map(f).join(' ') : null);
		const text = a.start !== null && a.end !== null ? p.graphemes.slice(a.start, a.end).join(s.unit === 'math' ? ' ' : '') : '';
		return [
			a.id, a.participantId, a.sessionId, a.attemptId, at.retest, s.id, s.category, s.lang, s.title,
			a.kind, a.start, a.end, text, c?.hex, c?.h, c?.s, c?.l, c?.lab[0], c?.lab[1], c?.lab[2],
			more.length, list((m) => m.hex), list((m) => m.h), list((m) => m.s), list((m) => m.l), list((m) => m.lab.join(',')),
			a.note, a.supersedes, undone.has(a.clientId), a.answeredAt, a.tz, a.shownMs, a.sincePrevMs, a.receivedAt, a.clientId
		];
	});
	return csv(
		[
			'id', 'participant', 'session', 'attempt', 'retest', 'stimulus', 'category', 'lang', 'title',
			'kind', 'start', 'end', 'text', 'hex', 'okhsl_h', 'okhsl_s', 'okhsl_l', 'oklab_L', 'oklab_a', 'oklab_b',
			'more_colours', 'more_hex', 'more_okhsl_h', 'more_okhsl_s', 'more_okhsl_l', 'more_oklab',
			'note', 'undoes', 'undone', 'answered_at', 'time_zone', 'ms_since_shown', 'ms_since_previous', 'received_at', 'client_id'
		],
		rows
	);
}

export async function reverseCsv() {
	const rows = await db.select().from(synReverse).orderBy(asc(synReverse.id));
	return csv(
		['id', 'participant', 'session', 'hex', 'okhsl_h', 'okhsl_s', 'okhsl_l', 'oklab_L', 'oklab_a', 'oklab_b', 'text', 'nothing', 'answered_at', 'time_zone', 'ms_since_shown', 'received_at'],
		rows.map((r) => {
			const c = r.colour as { h: number; s: number; l: number; hex: string; lab: [number, number, number] };
			return [r.id, r.participantId, r.sessionId, c.hex, c.h, c.s, c.l, c.lab[0], c.lab[1], c.lab[2], r.text, r.nothing, r.answeredAt, r.tz, r.shownMs, r.receivedAt];
		})
	);
}

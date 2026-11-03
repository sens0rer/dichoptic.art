import { json } from '@sveltejs/kit';
import { inArray, and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { body, fail } from '#lib/server/api';
import { db, synAnswers, synAttempts, synReverse } from '#lib/server/db';
import { participant, recordSession, refreshFinished } from '#lib/server/synesthesia';

const colour = z.object({
	h: z.number().min(0).max(1),
	s: z.number().min(0).max(1),
	l: z.number().min(0).max(1),
	hex: z.string().regex(/^#[0-9a-f]{6}$/),
	lab: z.tuple([z.number(), z.number(), z.number()])
});

const answer = z.object({
	clientId: z.string().min(8).max(64),
	attemptId: z.string().max(32),
	kind: z.enum(['colour', 'none', 'note', 'retract']),
	start: z.number().int().min(0).nullable(),
	end: z.number().int().min(0).nullable(),
	colour: colour.nullable(),
	note: z.string().max(5000).nullable(),
	supersedes: z.string().max(64).nullable(),
	answeredAt: z.iso.datetime({ offset: true }),
	tz: z.string().max(64).nullable(),
	shownMs: z.number().int().nullable(),
	sincePrevMs: z.number().int().nullable()
});

const reverse = z.object({
	clientId: z.string().min(8).max(64),
	colour,
	text: z.string().max(2000).nullable(),
	nothing: z.boolean(),
	answeredAt: z.iso.datetime({ offset: true }),
	tz: z.string().max(64).nullable(),
	shownMs: z.number().int().nullable()
});

const schema = z
	.object({
		session: z.object({ id: z.string().min(8).max(64), device: z.record(z.string(), z.unknown()) }),
		answers: z.array(answer).max(100).default([]),
		reverse: z.array(reverse).max(100).default([])
	})
	.refine((b) => b.answers.length + b.reverse.length > 0);

// Stores a batch from the device's outbox: marking answers and reverse-test answers.
// Resending a batch is harmless: client ids are unique.
export async function POST(event) {
	const parsed = schema.safeParse(await body(event));
	if (!parsed.success) return fail(400, 'Invalid request');
	const pid = await participant(event.cookies);
	const { session, answers, reverse } = parsed.data;

	const attemptIds = [...new Set(answers.map((a) => a.attemptId))];
	if (attemptIds.length) {
		const owned = await db
			.select({ id: synAttempts.id })
			.from(synAttempts)
			.where(and(inArray(synAttempts.id, attemptIds), eq(synAttempts.participantId, pid)));
		if (owned.length !== attemptIds.length) return fail(403, 'Not your item');
	}

	await recordSession(pid, session.id, session.device);
	if (reverse.length)
		await db
			.insert(synReverse)
			.values(reverse.map((r) => ({ ...r, participantId: pid, sessionId: session.id, answeredAt: new Date(r.answeredAt) })))
			.onConflictDoNothing();
	if (answers.length)
		await db
			.insert(synAnswers)
			.values(answers.map((a) => ({ ...a, participantId: pid, sessionId: session.id, answeredAt: new Date(a.answeredAt) })))
			.onConflictDoNothing();

	const finished: Record<string, boolean> = {};
	for (const id of attemptIds) finished[id] = await refreshFinished(id);
	return json({ finished });
}

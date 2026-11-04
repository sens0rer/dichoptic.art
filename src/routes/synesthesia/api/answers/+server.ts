import { json } from '@sveltejs/kit';
import { inArray, and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { body, fail } from '#lib/server/api';
import { db, synAnswers, synAttempts, synReverse } from '#lib/server/db';
import { enrol, participant, recordSession, refreshFinished } from '#lib/server/synesthesia';

const colour = z.object({
	h: z.number().min(0).max(1),
	s: z.number().min(0).max(1),
	l: z.number().min(0).max(1),
	hex: z.string().regex(/^#[0-9a-f]{6}$/),
	lab: z.tuple([z.number(), z.number(), z.number()])
});
// A marking answer may carry further colours.
const answerColour = colour.extend({ more: z.array(colour).max(20).optional() });

const answer = z.object({
	clientId: z.string().min(8).max(64),
	attemptId: z.string().max(32),
	kind: z.enum(['colour', 'none', 'note', 'flag', 'retract']),
	start: z.number().int().min(0).nullable(),
	end: z.number().int().min(0).nullable(),
	colour: answerColour.nullable(),
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

	// Answers for an item that no longer exists, or is not this browser's, are dropped rather than
	// refused: refusing would leave them in the device's outbox, retried forever.
	const requested = [...new Set(answers.map((a) => a.attemptId))];
	const owned = requested.length
		? new Set(
				(
					await db
						.select({ id: synAttempts.id })
						.from(synAttempts)
						.where(and(inArray(synAttempts.id, requested), eq(synAttempts.participantId, pid)))
				).map((r) => r.id)
			)
		: new Set<string>();
	const kept = answers.filter((a) => owned.has(a.attemptId));
	const attemptIds = [...owned];

	if (!kept.length && !reverse.length) return json({ finished: {}, dropped: answers.length });
	// The first answer makes this browser a participant.
	await enrol(pid);
	await recordSession(pid, session.id, session.device);
	if (reverse.length)
		await db
			.insert(synReverse)
			.values(reverse.map((r) => ({ ...r, participantId: pid, sessionId: session.id, answeredAt: new Date(r.answeredAt) })))
			.onConflictDoNothing();
	if (kept.length)
		await db
			.insert(synAnswers)
			.values(kept.map((a) => ({ ...a, participantId: pid, sessionId: session.id, answeredAt: new Date(a.answeredAt) })))
			.onConflictDoNothing();

	const finished: Record<string, boolean> = {};
	for (const id of attemptIds) finished[id] = await refreshFinished(id);
	return json({ finished, dropped: answers.length - kept.length });
}

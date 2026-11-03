import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { body, fail } from '#lib/server/api';
import { participant, setPosition } from '#lib/server/synesthesia';

const schema = z
	.object({
		attemptId: z.string().max(32),
		scroll: z.number().min(0),
		selection: z.object({ start: z.number().int().min(0), end: z.number().int().min(0) }).nullable()
	})
	.nullable();

// Where she is, for "Continue where you left off".
export async function POST(event) {
	const parsed = schema.safeParse(await body(event));
	if (!parsed.success) return fail(400, 'Invalid request');
	await setPosition(await participant(event.cookies), parsed.data);
	return json({ ok: true });
}

import { eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './db/schema';

const { synParticipants } = schema;

// Kept apart from the admin module, with the database passed in, so the same code runs from the
// admin page and from a script (scripts/synesthesia/merge-participants.ts).

// Ties one browser to another participant (the same person on another device): everything
// recorded moves to `into`, and `from` is marked so its cookie switches on its next visit. Each
// answer keeps its session, and so the device it was given on. An item both had started first
// time keeps the earlier attempt as the first and the later one as a retest. Nothing is deleted:
// rows only change participant, and `from` keeps a record of every row that moved.
export async function mergeParticipants(db: PostgresJsDatabase<typeof schema>, from: string, into: string) {
	if (from === into) throw new Error('Same participant');
	return db.transaction(async (t) => {
		const [source] = await t.select().from(synParticipants).where(eq(synParticipants.id, from));
		const [target] = await t.select().from(synParticipants).where(eq(synParticipants.id, into));
		if (!source || source.mergedInto) throw new Error('No such participant to merge');
		if (!target || target.mergedInto) throw new Error('No such participant to merge into');
		const retests = await t.execute<{ id: string }>(sql`
			UPDATE syn_attempts a SET retest = true
			WHERE NOT a.retest AND a.participant_id IN (${from}, ${into}) AND EXISTS (
				SELECT 1 FROM syn_attempts b
				WHERE b.stimulus_id = a.stimulus_id AND NOT b.retest AND b.participant_id IN (${from}, ${into})
					AND (b.created_at, b.id) < (a.created_at, a.id))
			RETURNING a.id`);
		const moved: Record<string, (string | number)[]> = {};
		for (const table of ['syn_attempts', 'syn_answers', 'syn_sessions', 'syn_reverse', 'syn_result_views']) {
			const rows = await t.execute<{ id: string | number }>(
				sql`UPDATE ${sql.identifier(table)} SET participant_id = ${into} WHERE participant_id = ${from} RETURNING id`
			);
			moved[table] = [...rows].map((r) => r.id);
		}
		const record = {
			into,
			at: new Date().toISOString(),
			moved,
			madeRetests: [...retests].map((r) => r.id),
			position: source.position
		};
		await t.update(synParticipants).set({ mergedInto: into, mergeRecord: record, position: null }).where(eq(synParticipants.id, from));
		// Anything already tied to `from` now points straight at `into`.
		await t.update(synParticipants).set({ mergedInto: into }).where(eq(synParticipants.mergedInto, from));
		return record;
	});
}

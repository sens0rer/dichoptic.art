import { error } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { isAdmin } from '#lib/server/admin';
import { db } from '#lib/server/db';

// Admin only: who has answered, so answers from anyone other than her are easy to filter out.
export async function load({ cookies }) {
	if (!isAdmin(cookies)) error(404, 'Not found');
	const participants = await db.execute<{ id: string; created_at: string; answers: number; reverse: number; last: string | null; devices: string | null }>(sql`
		SELECT p.id, p.created_at,
			(SELECT count(*)::int FROM syn_answers a WHERE a.participant_id = p.id) AS answers,
			(SELECT count(*)::int FROM syn_reverse r WHERE r.participant_id = p.id) AS reverse,
			(SELECT max(a.answered_at) FROM syn_answers a WHERE a.participant_id = p.id) AS last,
			(SELECT string_agg(DISTINCT s.device->>'userAgent', ' | ') FROM syn_sessions s WHERE s.participant_id = p.id) AS devices
		FROM syn_participants p
		ORDER BY p.created_at`);
	return { participants: [...participants] };
}

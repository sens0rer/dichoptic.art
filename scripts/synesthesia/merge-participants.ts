// Ties one browser to another participant (the same person on another device), as the admin
// participant page does: everything recorded moves, nothing is deleted, and the moved rows are
// listed on the old participant. Without --apply it only shows what would move.
//   npx tsx scripts/synesthesia/merge-participants.ts <from> <into> [--apply]
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/lib/server/db/schema';
import { mergeParticipants } from '../../src/lib/server/synesthesiaMerge';

const [from, into] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const apply = process.argv.includes('--apply');
if (!from || !into) throw new Error('Usage: merge-participants.ts <from> <into> [--apply]');

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

const TABLES = ['syn_attempts', 'syn_answers', 'syn_sessions', 'syn_reverse', 'syn_result_views'];
const counts = async () => {
	const out: Record<string, number> = {};
	for (const t of TABLES) out[t] = (await client`select count(*)::int n from ${client(t)} where participant_id in (${from}, ${into})`)[0].n;
	return out;
};

const before = await counts();
console.log('rows of both, before:', before);
if (apply) {
	const record = await mergeParticipants(db, from, into);
	console.log('moved:', Object.fromEntries(Object.entries(record.moved).map(([k, v]) => [k, v.length])), 'made retests:', record.madeRetests.length);
	const after = await counts();
	console.log('rows of both, after: ', after);
	const lost = TABLES.filter((t) => after[t] !== before[t]);
	console.log(lost.length ? `ROW COUNTS CHANGED: ${lost.join(', ')}` : 'no rows lost');
}
await client.end();

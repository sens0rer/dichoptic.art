import { eq } from 'drizzle-orm';
import { config } from './config';
import { db, siteState } from './db';

// Moderation can be switched in /admin. The switch lives in the database; until it has been used,
// the MODERATION environment variable decides.
export async function moderationOn(): Promise<boolean> {
	const [row] = await db.select().from(siteState).where(eq(siteState.key, 'moderation'));
	return row ? (row.value as { on: boolean }).on : config.moderation;
}

export async function setModeration(on: boolean) {
	await db
		.insert(siteState)
		.values({ key: 'moderation', value: { on } })
		.onConflictDoUpdate({ target: siteState.key, set: { value: { on } } });
}

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { chromacyTypes } from '../src/lib/server/db/schema';

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);
await migrate(db, { migrationsFolder: './drizzle' });
await db
	.insert(chromacyTypes)
	.values([
		{ code: 'TRT', name: 'True Red Tetrachromacy', chromacy: 'tetra' },
		{ code: 'TCP', name: 'True Cyan Pentachromacy', chromacy: 'penta' },
		{ code: 'TMP', name: 'True Magenta Pentachromacy', chromacy: 'penta' },
		{
			code: 'TBPH',
			name: 'Triple Band Pass Hexachromacy (using Infitec glasses)',
			chromacy: 'hexa'
		}
	])
	.onConflictDoNothing();
await client.end();
console.log('migrated');

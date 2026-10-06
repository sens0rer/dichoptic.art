import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

// Local Postgres without Docker: real Postgres binaries, data kept under data/pg.
const dir = 'data/pg';
const pg = new EmbeddedPostgres({
	databaseDir: dir,
	user: 'postgres',
	password: 'postgres',
	port: 5433,
	persistent: true
});

if (!existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
try {
	await pg.createDatabase('dichoptic');
} catch {
	// already exists
}
console.log('postgres ready on postgres://postgres:postgres@localhost:5433/dichoptic');

const stop = async () => {
	await pg.stop();
	process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

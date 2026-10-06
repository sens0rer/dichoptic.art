import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config';
import * as schema from './schema';

const make = () => {
	const g = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };
	// Neon-style pooled endpoints do not support prepared statements.
	g.__sql ??= postgres(config.databaseUrl, { prepare: false });
	return drizzle(g.__sql, { schema });
};

type Db = ReturnType<typeof make>;
let instance: Db | undefined;

// Connects on first use so importing this module (e.g. during build) needs no environment.
export const db: Db = new Proxy({} as Db, {
	get: (_, prop) => Reflect.get((instance ??= make()), prop)
});
export type { Db };
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export * from './schema';

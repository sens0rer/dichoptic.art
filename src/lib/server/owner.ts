import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { db, owners } from './db';
import { newId } from './ids';

export const OWNER_COOKIE = 'owner_key';

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

export interface Owner {
	id: string;
	key: string;
}

// Consent lives in the visitor's localStorage; the client declares it per request.
export const hasConsent = (request: Request) => request.headers.get('x-consent') === 'accepted';

export function setOwnerCookie(cookies: Cookies, key: string) {
	cookies.set(OWNER_COOKIE, key, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365 * 10
	});
}

export async function findOwner(key: string | undefined): Promise<Owner | null> {
	if (!key) return null;
	const [row] = await db.select().from(owners).where(eq(owners.keyHash, hashKey(key)));
	return row ? { id: row.id, key } : null;
}

export const currentOwner = (cookies: Cookies) => findOwner(cookies.get(OWNER_COOKIE));

// Returns the visitor's owner, creating one on first need. The cookie is only set with consent;
// without it the caller still gets the key, to show the recovery link.
export async function ensureOwner(
	cookies: Cookies,
	request: Request
): Promise<Owner & { created: boolean }> {
	const existing = await currentOwner(cookies);
	if (existing) return { ...existing, created: false };
	const key = randomBytes(32).toString('base64url');
	const id = newId();
	await db.insert(owners).values({ id, keyHash: hashKey(key) });
	if (hasConsent(request)) setOwnerCookie(cookies, key);
	return { id, key, created: true };
}

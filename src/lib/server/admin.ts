import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { config } from './config';

export const ADMIN_COOKIE = 'admin';

// The cookie holds a MAC derived from the token, not the token itself.
const mac = () => createHmac('sha256', config.secret).update(`admin:${config.adminToken}`).digest('base64url');

function equal(a: string, b: string) {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

export const isAdmin = (cookies: Cookies) => {
	const v = cookies.get(ADMIN_COOKIE);
	return !!v && equal(v, mac());
};

export function login(cookies: Cookies, token: string): boolean {
	if (!equal(token, config.adminToken)) return false;
	cookies.set(ADMIN_COOKIE, mac(), {
		path: '/admin',
		httpOnly: true,
		sameSite: 'strict',
		maxAge: 60 * 60 * 24 * 30
	});
	return true;
}

export const logout = (cookies: Cookies) => cookies.delete(ADMIN_COOKIE, { path: '/admin' });

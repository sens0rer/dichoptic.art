import { error } from '@sveltejs/kit';
import { isAdmin } from '#lib/server/admin';

// Admin only (sign in at /admin); to anyone else these pages do not exist.
export async function load({ cookies }) {
	if (!isAdmin(cookies)) error(404, 'Not found');
	return {};
}

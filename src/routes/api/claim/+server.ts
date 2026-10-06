import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { fail } from '#lib/server/api';
import { findOwner, hasConsent, setOwnerCookie } from '#lib/server/owner';

export async function POST({ request, cookies }) {
	const parsed = z.object({ key: z.string() }).safeParse(await request.json().catch(() => null));
	if (!parsed.success) return fail(400, 'Invalid request');
	if (!hasConsent(request)) return fail(403, 'Accept cookies to continue', { consent: true });
	if (!(await findOwner(parsed.data.key))) return fail(404, 'This recovery link is not valid');
	setOwnerCookie(cookies, parsed.data.key);
	return json({ ok: true });
}

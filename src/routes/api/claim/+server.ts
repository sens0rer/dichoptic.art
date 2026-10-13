import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { fail } from '#lib/server/api';
import { hasHoldings, holdings, mergeOwner } from '#lib/server/claim';
import { db } from '#lib/server/db';
import { currentOwner, findOwner, hasConsent, setOwnerCookie } from '#lib/server/owner';

const schema = z.object({ key: z.string(), merge: z.boolean().optional() });

// Opening a recovery link: this browser becomes that owner. If the browser already has submissions
// or likes of its own, they are combined into the owner from the link, but only after confirmation.
export async function POST({ request, cookies }) {
	const parsed = schema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return fail(400, 'Invalid request');
	if (!hasConsent(request)) return fail(403, 'Accept cookies to continue', { consent: true });
	const target = await findOwner(parsed.data.key);
	if (!target) return fail(404, 'This recovery link is not valid');

	const current = await currentOwner(cookies);
	if (current && current.id !== target.id) {
		const held = await holdings(current.id);
		if (hasHoldings(held)) {
			if (!parsed.data.merge)
				return fail(409, 'This browser already has submissions', { needsConfirm: true, held });
			await db.transaction((tx) => mergeOwner(tx, current.id, target.id));
		}
	}
	setOwnerCookie(cookies, parsed.data.key);
	return json({ ok: true });
}

import { error } from '@sveltejs/kit';
import { hasHoldings, holdings } from '#lib/server/claim';
import { currentOwner, findOwner } from '#lib/server/owner';

export async function load({ params, cookies }) {
	const target = await findOwner(params.key);
	if (!target) error(404, 'This recovery link is not valid');
	const current = await currentOwner(cookies);
	const held = current && current.id !== target.id ? await holdings(current.id) : null;
	return { key: params.key, held: held && hasHoldings(held) ? held : null };
}

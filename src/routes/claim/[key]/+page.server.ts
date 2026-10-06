import { error } from '@sveltejs/kit';
import { findOwner } from '#lib/server/owner';

export async function load({ params }) {
	if (!(await findOwner(params.key))) error(404, 'This recovery link is not valid');
	return { key: params.key };
}

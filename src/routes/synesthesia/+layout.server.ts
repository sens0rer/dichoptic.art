import { participant } from '#lib/server/synesthesia';

// Unlisted: nothing links here, and search engines are told not to list it.
export async function load({ cookies, setHeaders }) {
	setHeaders({ 'x-robots-tag': 'noindex, nofollow' });
	await participant(cookies);
	return {};
}

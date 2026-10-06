import { mySubmissions } from '#lib/server/content';
import { OWNER_COOKIE, currentOwner } from '#lib/server/owner';

export async function load({ cookies }) {
	const owner = await currentOwner(cookies);
	if (!owner) return { owner: false as const };
	return {
		owner: true as const,
		recovery: `/claim/${cookies.get(OWNER_COOKIE)}`,
		...(await mySubmissions(owner.id))
	};
}

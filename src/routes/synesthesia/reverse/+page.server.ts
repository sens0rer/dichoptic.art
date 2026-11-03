import { participant, reverseCount } from '#lib/server/synesthesia';

export async function load({ cookies }) {
	return { answered: await reverseCount(await participant(cookies)) };
}

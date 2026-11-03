import { attemptsList, CATEGORIES, participant } from '#lib/server/synesthesia';

export async function load({ cookies }) {
	const pid = await participant(cookies);
	const finished = await attemptsList(pid, true);
	const retests = new Map<string, number>();
	for (const a of finished) if (a.retest) retests.set(a.stimulusId, (retests.get(a.stimulusId) ?? 0) + 1);
	// One entry per item (its first attempt), grouped by category in the home page's order.
	return {
		groups: CATEGORIES.filter((c) => c.kind === 'items')
			.map((c) => ({
				name: c.name,
				items: finished
					.filter((a) => !a.retest && a.category === c.id)
					.map((a) => ({
						id: a.id,
						title: a.title,
						preview: a.body.replace(/\s+/g, ' ').slice(0, 80),
						retests: retests.get(a.stimulusId) ?? 0
					}))
			}))
			.filter((g) => g.items.length)
	};
}

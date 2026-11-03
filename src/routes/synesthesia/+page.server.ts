import { fail, redirect } from '@sveltejs/kit';
import {
	attemptsList,
	CATEGORIES,
	category,
	counts,
	getPosition,
	participant,
	retestsAvailable,
	reverseCount,
	startNext
} from '#lib/server/synesthesia';

export async function load({ cookies }) {
	const pid = await participant(cookies);
	const [c, unfinished, position, retests, reverse] = await Promise.all([
		counts(pid),
		attemptsList(pid, false),
		getPosition(pid),
		retestsAvailable(pid),
		reverseCount(pid)
	]);
	const inGroup = (id: string) => unfinished.filter((u) => (id === 'retests' ? u.retest : !u.retest && u.category === id));
	return {
		categories: CATEGORIES.filter((cat) => !('hidden' in cat)).map((cat) => {
			const n = c[cat.id] ?? { total: 0, finished: 0, unfinished: 0 };
			const fresh = n.total - n.finished - n.unfinished;
			// The status line, split around "N unfinished", which the page turns into a toggle.
			const [before, after] =
				cat.kind === 'retests'
					? [`${retests} ready to retest · `, '']
					: cat.kind === 'reverse'
						? [`${reverse} answered`, '']
						: [`${n.finished} finished · `, ` · ${fresh} new`];
			const startable = cat.kind === 'retests' ? retests > 0 : cat.kind === 'reverse' || fresh > 0;
			// Unfinished items of this category (for Retests, the unfinished retests), newest first.
			const unfinishedItems = inGroup(cat.id).map((u) => ({
				id: u.id,
				title: u.title,
				preview: u.body.replace(/\s+/g, ' ').slice(0, 80),
				from: u.retest ? (category(u.category)?.name ?? u.category) : null
			}));
			return {
				id: cat.id,
				name: cat.name,
				description: cat.description,
				before,
				after,
				hasUnfinished: cat.kind !== 'reverse',
				unfinished: unfinishedItems,
				startable
			};
		}),
		continueTo: position?.attemptId ?? null
	};
}

export const actions = {
	// Starting is a POST, not a link, so that prefetching can never create an attempt.
	start: async ({ request, cookies }) => {
		const pid = await participant(cookies);
		const cat = category(String((await request.formData()).get('category') ?? ''));
		if (!cat) return fail(400, { error: 'Unknown category' });
		if (cat.kind === 'reverse') redirect(303, '/synesthesia/reverse');
		const id = await startNext(pid, cat.id);
		if (!id) return fail(404, { error: `Nothing new left in ${cat.name}.`, category: cat.id });
		redirect(303, `/synesthesia/a/${id}`);
	}
};

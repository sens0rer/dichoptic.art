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
	return {
		categories: CATEGORIES.map((cat) => {
			const n = c[cat.id] ?? { total: 0, finished: 0, unfinished: 0 };
			const fresh = n.total - n.finished - n.unfinished;
			const status =
				cat.kind === 'retests'
					? `${retests} ready to retest`
					: cat.kind === 'reverse'
						? `${reverse} answered`
						: `${n.finished} finished · ${n.unfinished} unfinished · ${fresh} new`;
			const startable = cat.kind === 'retests' ? retests > 0 : cat.kind === 'reverse' || fresh > 0;
			return { id: cat.id, name: cat.name, description: cat.description, status, startable };
		}),
		unfinished: unfinished.map((u) => ({
			id: u.id,
			category: (category(u.category)?.name ?? u.category) + (u.retest ? ' · retest' : ''),
			title: u.title,
			preview: u.body.replace(/\s+/g, ' ').slice(0, 80)
		})),
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

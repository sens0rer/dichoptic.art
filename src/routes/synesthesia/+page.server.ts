import { fail, redirect } from '@sveltejs/kit';
import {
	attemptsList,
	CATEGORIES,
	category,
	counts,
	getPosition,
	participant,
	startNext
} from '#lib/server/synesthesia';

export async function load({ cookies }) {
	const pid = await participant(cookies);
	const [c, unfinished, position] = await Promise.all([counts(pid), attemptsList(pid, false), getPosition(pid)]);
	return {
		categories: CATEGORIES.map((cat) => ({ ...cat, ...(c[cat.id] ?? { total: 0, finished: 0, unfinished: 0 }) })),
		unfinished: unfinished.map((u) => ({
			id: u.id,
			category: category(u.category)?.name ?? u.category,
			title: u.title,
			preview: u.body.slice(0, 80)
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
		const id = await startNext(pid, cat.id);
		if (!id) return fail(404, { error: `Nothing new left in ${cat.name}.`, category: cat.id });
		redirect(303, `/synesthesia/a/${id}`);
	}
};

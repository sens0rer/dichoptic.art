import { error } from '@sveltejs/kit';
import { category, participant, result } from '#lib/server/synesthesia';

export async function load({ cookies, params }) {
	const pid = await participant(cookies);
	const r = await result(pid, params.id);
	if (!r || !r.attempts.length) error(404, 'Not found');
	return {
		stimulus: {
			body: r.stimulus.body,
			unit: r.stimulus.unit,
			lang: r.stimulus.lang,
			title: r.stimulus.title,
			category: category(r.stimulus.category)?.name ?? r.stimulus.category
		},
		attempts: r.attempts.map((a) => ({ id: a.id, retest: a.retest, finishedAt: a.finishedAt?.toISOString() ?? null, answers: a.answers }))
	};
}

import { error, redirect } from '@sveltejs/kit';
import { activeAnswers, category, getAttempt, getPosition, participant, startNext, type CategoryId } from '#lib/server/synesthesia';

export async function load({ cookies, params }) {
	const pid = await participant(cookies);
	const row = await getAttempt(pid, params.id);
	if (!row) error(404, 'Not found');
	const position = await getPosition(pid);
	return {
		attempt: { id: row.attempt.id, finished: !!row.attempt.finishedAt },
		stimulus: {
			body: row.stimulus.body,
			unit: row.stimulus.unit,
			lang: row.stimulus.lang,
			title: row.stimulus.title,
			category: category(row.stimulus.category)?.name ?? row.stimulus.category
		},
		answers: await activeAnswers(row.attempt.id),
		position: position?.attemptId === row.attempt.id ? position : null
	};
}

export const actions = {
	// "Next" and "Skip" both start the next new item in the same category; an item left
	// unmarked simply stays in Unfinished.
	next: async ({ cookies, params }) => {
		const pid = await participant(cookies);
		const row = await getAttempt(pid, params.id);
		if (!row) error(404, 'Not found');
		const id = await startNext(pid, row.stimulus.category as CategoryId);
		redirect(303, id ? `/synesthesia/a/${id}` : `/synesthesia?empty=${row.stimulus.category}`);
	}
};

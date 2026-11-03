import { error, redirect } from '@sveltejs/kit';
import { activeAnswers, category, getAttempt, getPosition, participant, startNext, type CategoryId } from '#lib/server/synesthesia';

export async function load({ cookies, params }) {
	const pid = await participant(cookies);
	const row = await getAttempt(pid, params.id);
	if (!row) error(404, 'Not found');
	const position = await getPosition(pid);
	const active = await activeAnswers(row.attempt.id);
	// "I know this song", for song items: the flag answer in force, if any.
	const known = active.find((a) => a.kind === 'flag' && a.note === 'knows-song');
	return {
		attempt: { id: row.attempt.id, finished: !!row.attempt.finishedAt, retest: row.attempt.retest },
		stimulus: {
			body: row.stimulus.body,
			unit: row.stimulus.unit,
			lang: row.stimulus.lang,
			title: row.stimulus.title,
			category: row.attempt.retest ? 'Retest' : (category(row.stimulus.category)?.name ?? row.stimulus.category)
		},
		answers: active
			.filter((a) => a.kind !== 'flag')
			.map(({ clientId, kind, start, end }) => ({ clientId, kind: kind as 'colour' | 'none' | 'note', start, end })),
		song: row.stimulus.category === 'lyrics' ? { knownId: known?.clientId ?? null } : null,
		position: position?.attemptId === row.attempt.id ? position : null
	};
}

export const actions = {
	// "Next" and "Skip" both start the next item in the same category (Retests, for a retest);
	// an item left unmarked simply stays in Unfinished.
	next: async ({ cookies, params }) => {
		const pid = await participant(cookies);
		const row = await getAttempt(pid, params.id);
		if (!row) error(404, 'Not found');
		const cat = (row.attempt.retest ? 'retests' : row.stimulus.category) as CategoryId;
		const id = await startNext(pid, cat);
		redirect(303, id ? `/synesthesia/a/${id}` : `/synesthesia?empty=${cat}`);
	}
};

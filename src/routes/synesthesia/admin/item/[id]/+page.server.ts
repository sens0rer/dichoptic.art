import { error, fail } from '@sveltejs/kit';
import { isAdmin } from '#lib/server/admin';
import { category } from '#lib/server/synesthesia';
import { item, itemResults, setHidden } from '#lib/server/synesthesiaAdmin';

export async function load({ params }) {
	const found = await item(params.id);
	if (!found) error(404, 'Not found');
	const { item: s, usage } = found;
	return {
		item: {
			id: s.id,
			category: { id: s.category, name: category(s.category)?.name ?? s.category },
			unit: s.unit,
			lang: s.lang,
			title: s.title,
			body: s.body,
			source: s.source,
			hidden: s.hidden,
			createdAt: s.createdAt.toISOString()
		},
		usage: usage.map((u) => ({ ...u, last: u.last ? new Date(u.last).toISOString() : null })),
		results: (await itemResults(s.id)).map((a) => ({
			id: a.id,
			participantId: a.participantId,
			retest: a.retest,
			started: a.createdAt.toISOString(),
			finished: a.finishedAt?.toISOString() ?? null,
			answers: a.answers
		}))
	};
}

export const actions = {
	// Actions skip the layout's load, so the admin check is repeated here.
	hidden: async ({ params, request, cookies }) => {
		if (!isAdmin(cookies)) error(404, 'Not found');
		const value = (await request.formData()).get('hidden');
		if (value !== 'true' && value !== 'false') return fail(400, { error: 'Invalid request' });
		await setHidden(params.id, value === 'true');
		return { ok: true };
	}
};

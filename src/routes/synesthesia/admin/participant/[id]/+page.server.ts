import { error } from '@sveltejs/kit';
import { CATEGORIES } from '#lib/server/synesthesia';
import { participantSummary } from '#lib/server/synesthesiaAdmin';

export async function load({ params }) {
	const s = await participantSummary(params.id);
	if (!s.participant) error(404, 'Not found');
	const preview = (a: { unit: string; title: string | null; body: string }) =>
		a.title ?? (a.unit === 'math' ? 'maths' : a.body.replace(/\s+/g, ' ').slice(0, 90));
	return {
		id: s.participant.id,
		since: s.participant.createdAt.toISOString(),
		// Grouped by category, in the home page's order.
		groups: CATEGORIES.filter((c) => c.kind === 'items')
			.map((c) => ({
				name: c.name,
				items: s.attempts
					.filter((a) => a.category === c.id)
					.map((a) => ({
						attemptId: a.id,
						stimulusId: a.stimulus_id,
						preview: preview(a),
						retest: a.retest,
						finished: a.finished_at ? new Date(a.finished_at).toISOString() : null,
						answers: a.answers
					}))
			}))
			.filter((g) => g.items.length),
		reverse: s.reverse.map((r) => ({
			id: r.id,
			hex: (r.colour as { hex: string }).hex,
			text: r.text,
			nothing: r.nothing,
			at: r.answeredAt.toISOString()
		}))
	};
}

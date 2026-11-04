import { error, fail, redirect } from '@sveltejs/kit';
import { isAdmin } from '#lib/server/admin';
import { CATEGORIES } from '#lib/server/synesthesia';
import { db } from '#lib/server/db';
import { participantSummary } from '#lib/server/synesthesiaAdmin';
import { mergeParticipants } from '#lib/server/synesthesiaMerge';
import { deviceLabel } from '#lib/synesthesia/device';

export async function load({ params }) {
	const s = await participantSummary(params.id);
	if (!s.participant) error(404, 'Not found');
	const preview = (a: { unit: string; title: string | null; body: string }) =>
		a.title ?? (a.unit === 'math' ? 'maths' : a.body.replace(/\s+/g, ' ').slice(0, 90));
	const label = new Map(s.sessions.map((x) => [x.id, deviceLabel(x.device)]));
	return {
		id: s.participant.id,
		since: s.participant.createdAt.toISOString(),
		mergedInto: s.participant.mergedInto,
		// Every visit, with its device: answers point at their visit, so each test's device is known.
		sessions: s.sessions.map((x) => ({ id: x.id, device: label.get(x.id)!, at: x.createdAt.toISOString() })),
		tied: s.tied.map((t) => ({ id: t.id, at: (t.record as { at?: string } | null)?.at ?? null })),
		others: s.others.map((o) => o.id),
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
						answers: a.answers,
						devices: [...new Set(a.sessions.map((id) => label.get(id) ?? 'unknown'))]
					}))
			}))
			.filter((g) => g.items.length),
		reverse: s.reverse.map((r) => ({
			id: r.id,
			hex: (r.colour as { hex: string }).hex,
			text: r.text,
			nothing: r.nothing,
			device: label.get(r.sessionId) ?? 'unknown',
			at: r.answeredAt.toISOString()
		}))
	};
}

export const actions = {
	// Ties this browser to another participant (the same person on another device). Form actions
	// skip the layout's load, so the admin check is repeated here.
	merge: async ({ cookies, params, request }) => {
		if (!isAdmin(cookies)) error(404, 'Not found');
		const into = String((await request.formData()).get('into') ?? '');
		try {
			await mergeParticipants(db, params.id, into);
		} catch (e) {
			return fail(400, { message: String((e as Error).message) });
		}
		redirect(303, `/synesthesia/admin/participant/${into}`);
	}
};

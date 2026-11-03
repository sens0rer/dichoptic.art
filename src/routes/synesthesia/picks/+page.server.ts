import { fail, redirect } from '@sveltejs/kit';
import { guessLang } from '#lib/server/lyrics';
import { addPick, participant } from '#lib/server/synesthesia';

export const actions = {
	add: async ({ request, cookies }) => {
		const pid = await participant(cookies);
		const form = await request.formData();
		const artist = String(form.get('artist') ?? '').trim().slice(0, 200);
		const track = String(form.get('track') ?? '').trim().slice(0, 200);
		const excerpt = String(form.get('excerpt') ?? '')
			.split(/\r?\n/)
			.map((l) => l.trim())
			.join('\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim()
			.slice(0, 10000);
		const lrclibId = Number(form.get('lrclibId')) || null;
		if (!artist || !track) return fail(400, { error: 'Please give the artist and the song title.' });
		if (!/\p{L}/u.test(excerpt)) return fail(400, { error: 'There are no lyrics to colour.' });
		const id = await addPick(pid, { artist, track, excerpt, lang: guessLang(excerpt), lrclibId });
		redirect(303, `/synesthesia/a/${id}`);
	}
};

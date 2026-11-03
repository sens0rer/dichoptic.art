import { json } from '@sveltejs/kit';
import { fail } from '#lib/server/api';
import { LyricsBusy, searchLyrics } from '#lib/server/lyrics';
import { participant } from '#lib/server/synesthesia';

// Search for "Your songs": the page asks here, and this asks LRCLIB.
export async function GET({ url, cookies }) {
	await participant(cookies);
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	if (q.length < 2) return json({ songs: [] });
	try {
		return json({ songs: await searchLyrics(q) });
	} catch (e) {
		if (e instanceof LyricsBusy) return fail(503, 'The lyrics library is busy right now. Try again in a minute, or paste the lyrics.');
		return fail(502, 'Could not reach the lyrics library. You can paste the lyrics instead.');
	}
}

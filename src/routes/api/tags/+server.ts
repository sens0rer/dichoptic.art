import { json } from '@sveltejs/kit';
import { suggestTags } from '#lib/server/content';

export async function GET({ url }) {
	return json(await suggestTags(url.searchParams.get('q') ?? ''));
}

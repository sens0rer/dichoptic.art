import { displayName } from '#lib/server/feed';
import { feedPage } from '#lib/server/feedPage';
import { normName, parseQuery } from '#lib/query';

export async function load({ url, params }) {
	const { filters, sort } = parseQuery(url.searchParams);
	const by = normName(params.name);
	const name = (await displayName(by)) ?? params.name;
	return { ...(await feedPage({ ...filters, by }, sort)), name, by };
}

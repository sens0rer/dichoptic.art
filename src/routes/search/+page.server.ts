import { feedPage } from '#lib/server/feedPage';
import { parseQuery } from '#lib/query';

export async function load({ url }) {
	const { filters, sort } = parseQuery(url.searchParams);
	return feedPage(filters, sort);
}

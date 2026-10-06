import { anchorOf, listEntries, PAGE_SIZE } from './feed';
import { chromacyPresets } from './content';
import { toParams, type Filters, type Sort } from '../query';

// Shared by the home feed, search and /by/:name.
export async function feedPage(filters: Filters, sort: Sort) {
	const entries = await listEntries(filters, sort);
	const last = entries.at(-1);
	return {
		entries,
		cursor:
			entries.length >= PAGE_SIZE && last
				? Buffer.from(JSON.stringify(anchorOf(last))).toString('base64url')
				: null,
		filters,
		sort,
		ctx: toParams(filters, sort).toString(),
		presets: await chromacyPresets()
	};
}

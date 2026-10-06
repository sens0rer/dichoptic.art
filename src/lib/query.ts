import { ALTERATIONS, CHROMACIES, DIMENSIONS, MEDIUMS } from './vocab';

export type Sort = 'new' | 'liked';

export interface Filters {
	q: string;
	dimension: string;
	medium: string;
	alteration: string;
	chromacy: string;
	chromacyType: string;
	tags: string[];
	// Normalised submitter name (see /by/:name).
	by: string;
}

export const normName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

const pick = (v: string | null, allowed: readonly string[]) => (v && allowed.includes(v) ? v : '');

export function parseQuery(params: URLSearchParams): { filters: Filters; sort: Sort } {
	return {
		sort: params.get('sort') === 'liked' ? 'liked' : 'new',
		filters: {
			q: (params.get('q') ?? '').trim().slice(0, 200),
			dimension: pick(params.get('dimension'), DIMENSIONS),
			medium: pick(params.get('medium'), MEDIUMS),
			alteration: pick(params.get('alteration'), ALTERATIONS),
			chromacy: pick(params.get('chromacy'), CHROMACIES),
			chromacyType: (params.get('chromacyType') ?? '').trim().slice(0, 100),
			tags: params
				.getAll('tag')
				.map((t) => t.trim().toLowerCase())
				.filter(Boolean)
				.slice(0, 20),
			by: normName(params.get('by') ?? '')
		}
	};
}

// The same parameters travel in the URL from a feed to an image page, which is how
// previous/next knows which list you came from.
export function toParams(filters: Filters, sort: Sort): URLSearchParams {
	const p = new URLSearchParams();
	if (sort !== 'new') p.set('sort', sort);
	if (filters.q) p.set('q', filters.q);
	for (const k of ['dimension', 'medium', 'alteration', 'chromacy', 'chromacyType'] as const)
		if (filters[k]) p.set(k, filters[k]);
	for (const t of filters.tags) p.append('tag', t);
	if (filters.by) p.set('by', filters.by);
	return p;
}

export interface Entry {
	type: 'image' | 'collection';
	id: string;
	title: string | null;
	thumbPrefix: string;
	thumbW: number;
	thumbH: number;
	likeCount: number;
	count: number;
	submittedBy: string | null;
	credit: string | null;
	ca: string;
}

export const entryHref = (e: Pick<Entry, 'type' | 'id'>, ctx: URLSearchParams) => {
	const qs = ctx.toString();
	return `/${e.type}/${e.id}${qs ? `?${qs}` : ''}`;
};

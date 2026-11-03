import { error } from '@sveltejs/kit';
import { category } from '#lib/server/synesthesia';
import { categoryItems } from '#lib/server/synesthesiaAdmin';

export async function load({ params, url }) {
	const cat = category(params.category);
	if (!cat || cat.kind !== 'items') error(404, 'Not found');
	const lang = url.searchParams.get('lang') || undefined;
	const hidden = url.searchParams.get('hidden') === '1';
	const all = await categoryItems(cat.id, { hidden: true });
	const items = all.filter((i) => (!lang || i.lang === lang) && (hidden || !i.hidden));
	return {
		category: { id: cat.id, name: cat.name },
		langs: [...new Set(all.map((i) => i.lang ?? ''))].filter(Boolean).sort(),
		filter: { lang: lang ?? '', hidden },
		hiddenCount: all.filter((i) => i.hidden).length,
		items: items.map((i) => ({
			id: i.id,
			lang: i.lang,
			title: i.title,
			preview: i.unit === 'math' ? (((i.source as { latex?: string[] })?.latex ?? []).join('   ') || 'maths') : i.body.replace(/\s+/g, ' ').slice(0, 140),
			source: describe(i.source),
			tags: (i.source as { tags?: Record<string, string> })?.tags ?? null,
			hidden: i.hidden,
			attempts: i.attempts,
			finished: i.finished
		}))
	};
}

// A one-line description of where an item came from.
function describe(source: unknown) {
	const s = (source ?? {}) as Record<string, unknown>;
	const what = s.work ?? s.page ?? s.article ?? s.song ?? s.what ?? (s.article !== undefined ? `article ${s.article}` : null) ?? s.file;
	return [s.from, what].filter(Boolean).join(': ');
}

import { CATEGORIES } from '#lib/server/synesthesia';
import { categoryStats } from '#lib/server/synesthesiaAdmin';

export async function load() {
	const stats = await categoryStats();
	return {
		categories: CATEGORIES.filter((c) => c.kind === 'items').map((c) => ({
			id: c.id,
			name: c.name,
			...(stats[c.id] ?? { items: 0, hidden: 0, attempts: 0, answers: 0, langs: null })
		}))
	};
}

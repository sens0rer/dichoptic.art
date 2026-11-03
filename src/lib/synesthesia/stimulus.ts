import { createHash } from 'node:crypto';

// Content hash: the same text in the same category is the same item, whoever adds it, so an
// answer always points at exactly what was shown. Used by the server and the import scripts.
export const stimulusId = (s: { category: string; unit: string; lang?: string | null; title?: string | null; body: string }) =>
	createHash('sha256')
		.update(JSON.stringify([s.category, s.unit, s.lang ?? null, s.title ?? null, s.body]))
		.digest('base64url')
		.slice(0, 22);

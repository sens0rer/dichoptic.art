import { createHash } from 'node:crypto';

// Content hash: the same text in the same category is the same item, whoever adds it, so an
// answer always points at exactly what was shown. Used by the server and the import scripts.
// Items a participant adds herself (her song picks) also hash her id, so they stay hers.
export const stimulusId = (s: { category: string; unit: string; lang?: string | null; title?: string | null; body: string; owner?: string }) =>
	createHash('sha256')
		.update(JSON.stringify([s.category, s.unit, s.lang ?? null, s.title ?? null, s.body, ...(s.owner ? [s.owner] : [])]))
		.digest('base64url')
		.slice(0, 22);

import { z } from 'zod';
import { ALTERATIONS, CHROMACIES, DIMENSIONS, MEDIUMS } from '../vocab';

const text = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((v) => v || null);

const choice = <T extends readonly [string, ...string[]]>(values: T) =>
	z
		.union([z.enum(values), z.literal(''), z.null()])
		.optional()
		.transform((v) => v || null);

export const normTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);

const credit = {
	creditName: text(200),
	creditUrl: z
		.string()
		.trim()
		.max(500)
		.nullish()
		// A bare "wikipedia.com" is accepted and stored as https://wikipedia.com.
		.transform((v) => (v ? (/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`) : null))
		.refine((v) => v === null || /^https?:\/\/[^\s/]+\.\S+$/i.test(v), 'Enter a valid web address'),
	submittedBy: text(100),
	author: text(100)
};

const classification = {
	dimension: choice(DIMENSIONS),
	medium: choice(MEDIUMS),
	alteration: choice(ALTERATIONS),
	chromacy: choice(CHROMACIES),
	chromacyType: text(100),
	filterInfo: text(500),
	private: z.boolean().optional().default(false),
	tags: z
		.array(z.string())
		.max(20)
		.default([])
		.transform((ts) => [...new Set(ts.map(normTag).filter(Boolean))])
};

function consistent<T extends { chromacy: string | null; chromacyType: string | null }>(v: T): T {
	return v.chromacy === 'none' ? { ...v, chromacyType: null } : v;
}

export const imageMetaSchema = (titleRequired: boolean) =>
	z
		.object({
			title: titleRequired ? z.string().trim().min(1, 'Title is required').max(200) : text(200),
			description: text(5000),
			...credit,
			...classification
		})
		.transform(consistent);

export const collectionMetaSchema = z
	.object({
		title: z.string().trim().min(1, 'Title is required').max(200),
		description: text(5000),
		...credit,
		...classification
	})
	.transform(consistent);

export type ImageMeta = z.output<ReturnType<typeof imageMetaSchema>>;
export type CollectionMeta = z.output<typeof collectionMetaSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of error.issues) out[String(issue.path[0] ?? '_')] ??= issue.message;
	return out;
}

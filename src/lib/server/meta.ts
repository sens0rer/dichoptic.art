import { z } from 'zod';
import { normalizeLinks } from '../links';
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

const isDay = (v: string) =>
	/^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

// One day of slack so a visitor ahead of the server's time zone can still pick "today".
const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Text where [word](address) makes a link; bare addresses get https:// added, non-web ones are rejected.
const linkedText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((v, ctx) => {
			if (!v) return null;
			const r = normalizeLinks(v);
			if ('error' in r) {
				ctx.addIssue({ code: 'custom', message: r.error });
				return z.NEVER;
			}
			return r.value;
		});

const credit = {
	credit: linkedText(500),
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
	date: z
		.string()
		.trim()
		.nullish()
		.transform((v) => v || null)
		.refine((v) => v === null || isDay(v), 'Enter a valid date')
		.refine((v) => v === null || v <= tomorrow(), 'The date cannot be in the future'),
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
			description: linkedText(5000),
			...credit,
			...classification
		})
		.transform(consistent);

export const collectionMetaSchema = z
	.object({
		title: z.string().trim().min(1, 'Title is required').max(200),
		description: linkedText(5000),
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

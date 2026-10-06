// Credit is free text where words can carry links, written as [word](address).
export interface CreditPart {
	text: string;
	href?: string;
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const SAFE = /^https?:\/\/[^\s/]+\.\S+$/i;

const withScheme = (url: string) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);

// Splits into plain and linked parts. A link whose address is not a web address stays plain text.
export function parseCredit(source: string): CreditPart[] {
	const parts: CreditPart[] = [];
	let last = 0;
	for (const m of source.matchAll(LINK)) {
		if (m.index > last) parts.push({ text: source.slice(last, m.index) });
		const href = withScheme(m[2]);
		parts.push(SAFE.test(href) ? { text: m[1], href } : { text: m[0] });
		last = m.index + m[0].length;
	}
	if (last < source.length) parts.push({ text: source.slice(last) });
	return parts;
}

export const creditText = (source: string | null) =>
	source ? parseCredit(source).map((p) => p.text).join('') : '';

// For saving: adds https:// to bare addresses, and rejects anything that is not a web address.
export function normalizeCredit(source: string): { value: string } | { error: string } {
	let bad = false;
	const value = source.replace(LINK, (_, label: string, url: string) => {
		const href = withScheme(url);
		if (!SAFE.test(href)) bad = true;
		return `[${label}](${href})`;
	});
	return bad
		? { error: 'Links in credit must be web addresses, e.g. [Wikipedia](wikipedia.org)' }
		: { value };
}

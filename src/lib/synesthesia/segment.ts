// Splitting stimulus text into what can be selected. Everything is counted in graphemes (what a
// reader sees as one character: a letter with its accents, a Hangul syllable, a Thai cluster), so
// a range means the same thing in every script. Shared by the page and the server.

// 'math': the body is MathML, and each visible symbol (an <mi>, <mn>, <mo> or <mtext>) is one part,
// and so is every mark the browser draws itself: the √ of a root and the bar of a fraction.
export type UnitKind = 'word' | 'char' | 'math';

export interface Span {
	start: number; // grapheme index, inclusive
	end: number; // exclusive
}

export interface Segment extends Span {
	// A word (letters or digits), as opposed to spaces and punctuation.
	word: boolean;
}

export interface Parsed {
	graphemes: string[];
	// Every word, space and punctuation run in order; handles snap to these.
	segments: Segment[];
	// segmentOf[g]: index into segments of the segment holding grapheme g.
	segmentOf: number[];
	// What must be covered for the item to be finished.
	units: Span[];
}

// The symbols of MathML, in document order, as their text. The page finds the same elements in
// the same order (see mathLeaves), so an index means the same symbol on the server and the page.
// Drawn marks have no element of their own: each counts as a symbol at its element's opening tag.
const LEAF = /<(mi|mn|mo|mtext)\b[^>]*>([^<]*)<\/\1>|<(msqrt|mroot|mfrac)\b([^>]*)>/g;
const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#x27;': "'" };
const decode = (s: string) => s.replace(/&(lt|gt|amp|quot|#x27);/g, (m) => ENTITIES[m]);
// Invisible operators (function application, invisible times…) and spacing are not symbols.
export const isMathLeaf = (text: string) => text.replace(/[⁡-⁤\s]/g, '') !== '';
// A fraction drawn without a bar (a binomial coefficient) has no mark.
const noBar = (thickness: string | null | undefined) => thickness != null && parseFloat(thickness) === 0;
const DRAWN: Record<string, string> = { msqrt: '√', mroot: '√', mfrac: '—' };
export const isDrawn = (e: Element) =>
	e.localName in DRAWN && !(e.localName === 'mfrac' && noBar(e.getAttribute('linethickness')));

// The symbols of rendered MathML, in the order parse() counts them.
export const mathLeaves = (root: Element) =>
	[...root.querySelectorAll<HTMLElement>('mi, mn, mo, mtext, msqrt, mroot, mfrac')].filter((e) =>
		e.localName in DRAWN ? isDrawn(e) : isMathLeaf(e.textContent ?? '')
	);

// Where a drawn mark is. A root's √: from the root's left edge to its base, full height (for
// <mroot> this includes the small index). A fraction's bar: full width, between numerator and
// denominator, at least 8px tall so it can be seen when highlighted.
export function drawnRect(e: Element) {
	const r = e.getBoundingClientRect();
	if (e.localName === 'mfrac') {
		const [num, den] = [...e.children].map((k) => k.getBoundingClientRect());
		const top = num ? num.bottom : r.top + r.height / 2;
		const bottom = den ? den.top : top;
		const mid = (top + bottom) / 2;
		const half = Math.max(4, (bottom - top) / 2);
		return { left: r.left, top: mid - half, right: r.right, bottom: mid + half };
	}
	const kids = e.localName === 'mroot' ? [...e.children].slice(0, 1) : [...e.children];
	const right = Math.min(r.right, ...kids.map((k) => k.getBoundingClientRect().left));
	return { left: r.left, top: r.top, right: Math.max(right, r.left + 4), bottom: r.bottom };
}

function parseMath(mathml: string): Parsed {
	const graphemes = [...mathml.matchAll(LEAF)]
		.filter((m) => !(m[3] === 'mfrac' && noBar(m[4].match(/linethickness=["']([^"']*)/)?.[1])))
		.map((m) => (m[3] ? DRAWN[m[3]] : decode(m[2])))
		.filter(isMathLeaf);
	const segments = graphemes.map((_, i) => ({ start: i, end: i + 1, word: true }));
	return { graphemes, segments, segmentOf: graphemes.map((_, i) => i), units: segments.map(({ start, end }) => ({ start, end })) };
}

export function parse(text: string, kind: UnitKind, lang?: string | null): Parsed {
	if (kind === 'math') return parseMath(text);
	const graphemes: string[] = [];
	// Grapheme index of each UTF-16 offset that starts a grapheme.
	const gAt = new Map<number, number>();
	for (const g of new Intl.Segmenter(lang ?? undefined, { granularity: 'grapheme' }).segment(text)) {
		gAt.set(g.index, graphemes.length);
		graphemes.push(g.segment);
	}
	gAt.set(text.length, graphemes.length);

	const segments: Segment[] = [];
	for (const w of new Intl.Segmenter(lang ?? undefined, { granularity: 'word' }).segment(text)) {
		const start = gAt.get(w.index)!;
		const end = gAt.get(w.index + w.segment.length)!;
		if (end > start) segments.push({ start, end, word: !!w.isWordLike });
	}
	const segmentOf: number[] = [];
	segments.forEach((s, i) => {
		for (let g = s.start; g < s.end; g++) segmentOf[g] = i;
	});

	const units: Span[] =
		kind === 'word'
			? segments.filter((s) => s.word).map(({ start, end }) => ({ start, end }))
			: graphemes.flatMap((g, i) => (isCharUnit(g) ? [{ start: i, end: i + 1 }] : []));
	return { graphemes, segments, segmentOf, units };
}

// In letter items, a part to mark is a grapheme with a letter, digit or symbol in it (◌ carrying a
// Thai vowel sign counts). Spaces and punctuation do not, nor does the Arabic tatweel or a
// zero-width joiner, which are only there to show a letter's joined forms.
const isCharUnit = (g: string) => /[\p{L}\p{N}\p{S}]/u.test(g.replace(/[ـ‍]/g, ''));

// Which graphemes are covered by the answers (colour or "no colour").
export function coveredMask(length: number, answers: Span[]): boolean[] {
	const mask = new Array<boolean>(length).fill(false);
	for (const a of answers) for (let g = Math.max(0, a.start); g < Math.min(length, a.end); g++) mask[g] = true;
	return mask;
}

// A unit is covered when every grapheme in it is, whether by one answer or several smaller ones.
export const isCovered = (u: Span, mask: boolean[]) => {
	for (let g = u.start; g < u.end; g++) if (!mask[g]) return false;
	return true;
};

export const allCovered = (p: Parsed, answers: Span[]) => {
	const mask = coveredMask(p.graphemes.length, answers);
	return p.units.every((u) => isCovered(u, mask));
};

// The first uncovered unit at or after `from`, wrapping round to the start; null when all are covered.
export function nextUncovered(p: Parsed, answers: Span[], from: number): Span | null {
	const mask = coveredMask(p.graphemes.length, answers);
	const open = p.units.filter((u) => !isCovered(u, mask));
	return open.find((u) => u.start >= from) ?? open[0] ?? null;
}

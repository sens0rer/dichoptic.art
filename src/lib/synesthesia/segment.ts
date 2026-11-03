// Splitting stimulus text into what can be selected. Everything is counted in graphemes (what a
// reader sees as one character: a letter with its accents, a Hangul syllable, a Thai cluster), so
// a range means the same thing in every script. Shared by the page and the server.

export type UnitKind = 'word' | 'char';

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

export function parse(text: string, kind: UnitKind, lang?: string | null): Parsed {
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
			: graphemes.flatMap((g, i) => (/^\s+$/u.test(g) ? [] : [{ start: i, end: i + 1 }]));
	return { graphemes, segments, segmentOf, units };
}

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

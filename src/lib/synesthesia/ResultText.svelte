<script lang="ts">
	import { isDrawn, mathLeaves, drawnRect, type Parsed } from './segment';

	interface ResultAnswer {
		kind: 'colour' | 'none' | 'note';
		start: number;
		end: number;
		hex: string | null;
		lightness: number | null;
		more?: { hex: string; lightness: number }[];
	}

	// A finished item drawn in her colours. Where answers overlap (a sentence and a word in it),
	// each character shows the most specific one: the shortest answer covering it.
	let {
		parsed,
		answers,
		math = null,
		lang = null,
		rtl = false,
		size = 22
	}: {
		parsed: Parsed;
		answers: ResultAnswer[];
		// For maths items: the MathML, whose symbols are coloured in place.
		math?: string | null;
		lang?: string | null;
		rtl?: boolean;
		size?: number;
	} = $props();

	const cover = $derived.by(() => {
		const best: (ResultAnswer | null)[] = parsed.graphemes.map(() => null);
		for (const a of answers) {
			if (a.kind === 'note') continue;
			for (let g = a.start; g < a.end; g++) {
				const cur = best[g];
				if (!cur || a.end - a.start <= cur.end - cur.start) best[g] = a;
			}
		}
		return best;
	});

	// Neighbouring characters showing the same answer are drawn as one run, so a coloured word
	// is one box, not a box per letter.
	const runs = $derived.by(() => {
		const out: { text: string; a: ResultAnswer | null }[] = [];
		parsed.graphemes.forEach((g, i) => {
			const last = out.at(-1);
			if (last && last.a === cover[i]) last.text += g;
			else out.push({ text: g, a: cover[i] });
		});
		return out;
	});

	// Dark text on light colours, light text on dark ones.
	// With several colours, by their average lightness.
	const colours = (a: ResultAnswer) => [{ hex: a.hex!, lightness: a.lightness ?? 0 }, ...(a.more ?? [])];
	const ink = (a: ResultAnswer) => {
		const cs = colours(a);
		return cs.reduce((t, c) => t + c.lightness, 0) / cs.length > 0.62 ? '#111' : '#fff';
	};
	// Several colours are drawn as equal stripes, left to right.
	const paint = (a: ResultAnswer) => {
		const cs = colours(a);
		if (cs.length === 1) return cs[0].hex;
		return `linear-gradient(to right, ${cs.map((c, i) => `${c.hex} ${(i * 100) / cs.length}% ${((i + 1) * 100) / cs.length}%`).join(', ')})`;
	};

	let mathBox = $state<HTMLElement>();
	// A root's √ and a fraction's bar are not elements of their own: their colour is a box drawn behind them.
	let radicals = $state<{ x: number; y: number; w: number; h: number; hex: string | null }[]>([]);
	function paintMath() {
		if (!mathBox) return;
		const b = mathBox.getBoundingClientRect();
		const marks: typeof radicals = [];
		mathLeaves(mathBox).forEach((leaf, i) => {
			const a = cover[i];
			if (isDrawn(leaf)) {
				const r = drawnRect(leaf);
				if (a && a.kind !== 'note')
					marks.push({ x: r.left - b.left, y: r.top - b.top, w: r.right - r.left, h: r.bottom - r.top, hex: a.kind === 'colour' ? paint(a) : null });
				return;
			}
			leaf.style.background = a?.kind === 'colour' ? paint(a) : '';
			leaf.style.color = a?.kind === 'colour' ? ink(a) : '';
			leaf.classList.toggle('none', a?.kind === 'none');
		});
		radicals = marks;
	}
	$effect(() => {
		void cover;
		paintMath();
		if (!mathBox) return;
		const ro = new ResizeObserver(paintMath);
		ro.observe(mathBox);
		return () => ro.disconnect();
	});
</script>

{#if math}
	<!-- On one line: the box keeps white space (pre-wrap). -->
	<div class="text math" bind:this={mathBox} style="--size: {size}px">{@html math}{#each radicals as m, i (i)}<div class="radical" class:none={!m.hex} style="left: {m.x}px; top: {m.y}px; width: {m.w}px; height: {m.h}px; background: {m.hex ?? 'transparent'}"></div>{/each}</div>
{:else}
	<div class="text" {lang} dir={rtl ? 'rtl' : 'ltr'} style="--size: {size}px">
		{#each runs as r, i (i)}{#if r.a?.kind === 'colour'}<span class="c" style="background: {paint(r.a)}; color: {ink(r.a)}"
					>{r.text}</span
				>{:else if r.a?.kind === 'none'}<span class="none">{r.text}</span>{:else}{r.text}{/if}{/each}
	</div>
{/if}

<style>
	.text {
		font-size: var(--size);
		line-height: 1.75;
		white-space: pre-wrap;
		overflow-wrap: break-word;
	}
	.c {
		padding: 0.08em 0;
	}
	.math :global(math) {
		margin: 0.5em 0;
	}
	.math {
		position: relative;
		isolation: isolate;
	}
	.radical {
		position: absolute;
		z-index: -1;
		pointer-events: none;
	}
	/* In maths, "no colour" is a dashed outline: an underline would turn + into ±. */
	.math :global(.none) {
		outline: 1.5px dashed rgba(0, 0, 0, 0.55);
		outline-offset: 1px;
	}
	/* "No colour": marked, but nothing to show. */
	.none {
		text-decoration: underline dashed 1.5px rgba(0, 0, 0, 0.55);
		text-underline-offset: 5px;
	}
</style>

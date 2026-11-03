<script lang="ts">
	import type { Parsed } from './segment';

	interface ResultAnswer {
		kind: 'colour' | 'none' | 'note';
		start: number;
		end: number;
		hex: string | null;
		lightness: number | null;
	}

	// A finished item drawn in her colours. Where answers overlap (a sentence and a word in it),
	// each character shows the most specific one: the shortest answer covering it.
	let {
		parsed,
		answers,
		lang = null,
		rtl = false,
		size = 22
	}: { parsed: Parsed; answers: ResultAnswer[]; lang?: string | null; rtl?: boolean; size?: number } = $props();

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
	const ink = (a: ResultAnswer) => ((a.lightness ?? 0) > 0.62 ? '#111' : '#fff');
</script>

<div class="text" {lang} dir={rtl ? 'rtl' : 'ltr'} style="--size: {size}px">
	{#each runs as r, i (i)}{#if r.a?.kind === 'colour'}<span class="c" style="background: {r.a.hex}; color: {ink(r.a)}"
				>{r.text}</span
			>{:else if r.a?.kind === 'none'}<span class="none">{r.text}</span>{:else}{r.text}{/if}{/each}
</div>

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
	/* "No colour": marked, but nothing to show. */
	.none {
		text-decoration: underline dashed 1.5px rgba(0, 0, 0, 0.55);
		text-underline-offset: 5px;
	}
</style>

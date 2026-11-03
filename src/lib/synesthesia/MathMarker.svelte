<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { isMathLeaf, type Parsed, type Span } from './segment';

	// Selection in typeset maths. Text-style handles follow reading order, which jumps between
	// numerator and denominator, sub- and superscripts; here selection is spatial and snaps to the
	// formula's structure: tap a symbol, drag a corner of the box around it, or pick an enclosing
	// group from the strip below.
	let {
		body,
		parsed,
		covered,
		size = 30,
		bottomInset = 0,
		disabled = false,
		selection = $bindable(null)
	}: {
		body: string;
		parsed: Parsed;
		covered: boolean[];
		size?: number;
		bottomInset?: number;
		disabled?: boolean;
		selection: Span | null;
	} = $props();

	let box = $state<HTMLElement>();
	// The symbols, in the same order as parse() finds them, and the symbol range under every element.
	let leaves: Element[] = [];
	let ranges = new Map<Element, Span>();

	function index() {
		if (!box) return;
		leaves = [...box.querySelectorAll('mi, mn, mo, mtext')].filter((e) => isMathLeaf(e.textContent ?? ''));
		ranges = new Map();
		leaves.forEach((leaf, i) => {
			for (let e: Element | null = leaf; e && e !== box; e = e.parentElement) {
				const r = ranges.get(e);
				ranges.set(e, r ? { start: Math.min(r.start, i), end: Math.max(r.end, i + 1) } : { start: i, end: i + 1 });
			}
		});
	}

	// ---- drawing: selected and answered symbols, and the box with its corners ----
	let frame = $state<{ x: number; y: number; w: number; h: number } | null>(null);
	let raw = $state<{ x: number; y: number; w: number; h: number } | null>(null);

	function union(sel: Span) {
		const b = box!.getBoundingClientRect();
		let l = Infinity, t = Infinity, r = -Infinity, btm = -Infinity;
		for (let i = sel.start; i < sel.end; i++) {
			const rc = leaves[i]?.getBoundingClientRect();
			if (!rc) continue;
			l = Math.min(l, rc.left);
			t = Math.min(t, rc.top);
			r = Math.max(r, rc.right);
			btm = Math.max(btm, rc.bottom);
		}
		const pad = 5;
		return { x: l - b.left - pad, y: t - b.top - pad, w: r - l + 2 * pad, h: btm - t + 2 * pad };
	}

	function paint() {
		leaves.forEach((leaf, i) => {
			leaf.classList.toggle('sel', !!selection && i >= selection.start && i < selection.end);
			leaf.classList.toggle('done', !!covered[i]);
		});
		frame = selection && box ? union(selection) : null;
	}

	function reveal() {
		if (!selection || drag || !leaves[selection.start]) return;
		const r = leaves[selection.start].getBoundingClientRect();
		const bottom = innerHeight - bottomInset - 24;
		if (r.bottom > bottom) scrollBy({ top: r.bottom - bottom + size, behavior: 'smooth' });
		else if (r.top < 24) scrollBy({ top: r.top - 24 - size, behavior: 'smooth' });
	}

	onMount(() => {
		index();
		paint();
		const ro = new ResizeObserver(paint);
		if (box) ro.observe(box);
		return () => ro.disconnect();
	});

	$effect(() => {
		void [selection?.start, selection?.end, covered];
		void tick().then(() => {
			paint();
			reveal();
		});
	});

	// ---- snapping a set of symbols to the structure ----
	// Elements that lay their children out in a row: within these, a run of neighbours can be
	// selected on its own. Anything else (fraction, power, root index, limit) is taken whole.
	const ROW = new Set(['math', 'mrow', 'msqrt', 'mstyle', 'mpadded', 'menclose', 'mphantom', 'div']);

	function snap(hit: number[]): Span | null {
		if (!hit.length) return null;
		const lo = Math.min(...hit);
		const hi = Math.max(...hit);
		// Lowest element holding every hit symbol.
		let lca: Element | null = leaves[lo];
		while (lca && lca !== box) {
			const r = ranges.get(lca)!;
			if (r.start <= lo && r.end > hi) break;
			lca = lca.parentElement;
		}
		if (!lca) return null;
		const whole = lca === box ? { start: 0, end: leaves.length } : ranges.get(lca)!;
		if (whole.end - whole.start === 1) return whole;
		if (!ROW.has(lca.localName) && lca !== box) return whole;
		const kids = [...lca.children].filter((c) => ranges.has(c));
		const first = kids.find((c) => ranges.get(c)!.end > lo);
		const last = [...kids].reverse().find((c) => ranges.get(c)!.start <= hi);
		if (!first || !last) return whole;
		return { start: ranges.get(first)!.start, end: ranges.get(last)!.end };
	}

	// The groups around the selection, smallest first, for the strip (x → x² → x²+1 → …).
	const groups = $derived.by(() => {
		void parsed;
		if (!selection || !box || !leaves.length) return [];
		const out: { range: Span; html: string }[] = [];
		let e: Element | null = leaves[selection.start];
		while (e && e !== box) {
			const r = ranges.get(e)!;
			const bigger = r.start <= selection.start && r.end >= selection.end && r.end - r.start > selection.end - selection.start;
			if (bigger && !out.some((o) => o.range.start === r.start && o.range.end === r.end))
				out.push({ range: r, html: e.localName === 'math' ? e.outerHTML : `<math>${e.outerHTML}</math>` });
			e = e.parentElement;
		}
		return out.slice(0, 5);
	});

	// ---- taps ----
	let press: { id: number; x: number; y: number; i: number } | null = null;

	function down(e: PointerEvent) {
		if (disabled || e.button > 0) return;
		const leaf = (e.target as Element).closest('mi, mn, mo, mtext');
		const i = leaf ? leaves.indexOf(leaf) : -1;
		press = i >= 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY, i } : null;
	}
	function up(e: PointerEvent) {
		if (!press || press.id !== e.pointerId) return;
		if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10) selection = { start: press.i, end: press.i + 1 };
		press = null;
	}

	// ---- dragging a corner ----
	let drag = $state<{ id: number; fx: number; fy: number } | null>(null);

	function cornerDown(e: PointerEvent, corner: 'tl' | 'tr' | 'bl' | 'br') {
		if (disabled || !frame || !box) return;
		e.stopPropagation();
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		const b = box.getBoundingClientRect();
		// The opposite corner stays put.
		const fx = b.left + (corner.endsWith('l') ? frame.x + frame.w : frame.x);
		const fy = b.top + (corner.startsWith('t') ? frame.y + frame.h : frame.y);
		drag = { id: e.pointerId, fx, fy };
	}

	function cornerMove(e: PointerEvent) {
		if (!drag || drag.id !== e.pointerId || !box) return;
		const l = Math.min(drag.fx, e.clientX);
		const r = Math.max(drag.fx, e.clientX);
		const t = Math.min(drag.fy, e.clientY);
		const btm = Math.max(drag.fy, e.clientY);
		const b = box.getBoundingClientRect();
		raw = { x: l - b.left, y: t - b.top, w: r - l, h: btm - t };
		const hit: number[] = [];
		leaves.forEach((leaf, i) => {
			const rc = leaf.getBoundingClientRect();
			const cx = (rc.left + rc.right) / 2;
			const cy = (rc.top + rc.bottom) / 2;
			if (cx >= l && cx <= r && cy >= t && cy <= btm) hit.push(i);
		});
		const s = snap(hit);
		if (s && (s.start !== selection?.start || s.end !== selection?.end)) selection = s;
	}

	function cornerUp(e: PointerEvent) {
		if (!drag || drag.id !== e.pointerId) return;
		drag = null;
		raw = null;
	}
</script>

<div class="wrap" class:disabled>
	<div
		class="math"
		bind:this={box}
		style="--size: {size}px"
		onpointerdown={down}
		onpointerup={up}
		onpointercancel={() => (press = null)}
		role="presentation"
	>
		{@html body}

		{#if raw}
			<div class="raw" style="left: {raw.x}px; top: {raw.y}px; width: {raw.w}px; height: {raw.h}px"></div>
		{/if}
		{#if frame}
			<div class="frame" style="left: {frame.x}px; top: {frame.y}px; width: {frame.w}px; height: {frame.h}px">
				{#each ['tl', 'tr', 'bl', 'br'] as const as c (c)}
					<span
						class="corner {c}"
						onpointerdown={(e) => cornerDown(e, c)}
						onpointermove={cornerMove}
						onpointerup={cornerUp}
						onpointercancel={cornerUp}
						role="presentation"
					><i></i></span>
				{/each}
			</div>
		{/if}
	</div>

	{#if groups.length}
		<div class="groups">
			<span class="label">Select the surrounding group:</span>
			{#each groups as g (g.range.start + ':' + g.range.end)}
				<button type="button" onclick={() => (selection = g.range)} {disabled}>{@html g.html}</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.math {
		position: relative;
		font-size: var(--size);
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		touch-action: manipulation;
		cursor: pointer;
		padding: 24px 28px 28px;
		overflow-x: auto;
	}
	.math :global(math) {
		font-family: 'STIX Two Math', 'Cambria Math', 'Latin Modern Math', math;
		/* Room between expressions for the corner knobs. */
		margin: 1em 0;
	}
	.math :global(.sel) {
		background: var(--syn-select, rgba(255, 255, 255, 0.55));
	}
	/* Answered symbols: a neutral grey tint, never her colour. (An underline would turn + into ±.) */
	.math :global(.done) {
		background: rgba(0, 0, 0, 0.16);
	}
	.math :global(.done.sel) {
		background: var(--syn-select, rgba(255, 255, 255, 0.55));
	}
	.frame,
	.raw {
		position: absolute;
		pointer-events: none;
		border-radius: 6px;
	}
	.frame {
		border: 2px solid #111;
	}
	.raw {
		border: 2px dashed rgba(0, 0, 0, 0.6);
	}
	/* Knobs sit diagonally outside the box so they never cover a small symbol; their touch areas
	   stay large. */
	.corner {
		position: absolute;
		width: 36px;
		height: 36px;
		pointer-events: auto;
		touch-action: none;
		cursor: grab;
		display: grid;
		place-items: center;
	}
	.corner i {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #111;
		border: 2px solid #fff;
	}
	.corner.tl {
		left: 0;
		top: 0;
		margin: -30px 0 0 -30px;
	}
	.corner.tr {
		left: 100%;
		top: 0;
		margin: -30px 0 0 -6px;
	}
	.corner.bl {
		left: 0;
		top: 100%;
		margin: -6px 0 0 -30px;
	}
	.corner.br {
		left: 100%;
		top: 100%;
		margin: -6px 0 0 -6px;
	}
	.groups {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 6px;
	}
	.groups .label {
		font-size: 0.8rem;
		color: var(--syn-muted);
		width: 100%;
	}
	.groups button {
		font-size: 18px;
		padding: 0.2em 0.6em;
		min-height: 44px;
	}
	.groups :global(math) {
		font-family: 'STIX Two Math', 'Cambria Math', 'Latin Modern Math', math;
	}
</style>

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { Parsed, Span } from './segment';

	// The stimulus text with custom selection: tap a word, drag the handles to grow or shrink,
	// touch-and-hold for a single letter. Parts already answered get a neutral underline; her
	// colours are never shown here.
	let {
		parsed,
		covered,
		lang = null,
		size = 22,
		bottomInset = 0,
		disabled = false,
		selection = $bindable(null)
	}: {
		parsed: Parsed;
		covered: boolean[];
		lang?: string | null;
		size?: number;
		bottomInset?: number;
		disabled?: boolean;
		selection: Span | null;
	} = $props();

	let box = $state<HTMLElement>();
	// The letter elements, in order (index = grapheme), read from the DOM after each render.
	let spans: HTMLElement[] = [];
	const collect = () => box && (spans = Array.from(box.querySelectorAll<HTMLElement>('[data-g]')));
	const lineHeight = $derived(Math.round(size * 1.7));

	// ---- handle positions ----
	let handles = $state<{ start: { x: number; y: number; h: number }; end: { x: number; y: number; h: number } } | null>(null);

	function measure() {
		collect();
		if (!selection || !box || !spans[selection.start] || !spans[selection.end - 1]) return void (handles = null);
		const b = box.getBoundingClientRect();
		const a = spans[selection.start].getBoundingClientRect();
		const z = spans[selection.end - 1].getBoundingClientRect();
		handles = {
			start: { x: a.left - b.left, y: a.bottom - b.top, h: a.height },
			end: { x: z.right - b.left, y: z.bottom - b.top, h: z.height }
		};
	}

	// Keep the selection on screen, above the docked picker (not while she drags a handle,
	// which scrolls by itself).
	function reveal() {
		collect();
		if (!selection || drag || !spans[selection.start]) return;
		const r = spans[selection.start].getBoundingClientRect();
		const bottom = innerHeight - bottomInset - 24;
		if (r.bottom > bottom) scrollBy({ top: r.bottom - bottom + lineHeight, behavior: 'smooth' });
		else if (r.top < 24) scrollBy({ top: r.top - 24 - lineHeight, behavior: 'smooth' });
	}

	$effect(() => {
		void [selection?.start, selection?.end, size, parsed];
		void tick().then(() => {
			measure();
			reveal();
		});
	});

	onMount(() => {
		const ro = new ResizeObserver(measure);
		if (box) ro.observe(box);
		return () => ro.disconnect();
	});

	// ---- picking the grapheme nearest a point ----
	let rects: DOMRect[] = [];
	const cacheRects = () => {
		collect();
		rects = spans.map((s) => s.getBoundingClientRect());
	};

	function nearest(x: number, y: number): number | null {
		let best: number | null = null;
		let bestDy = Infinity;
		let bestDx = Infinity;
		rects.forEach((r, g) => {
			if (!r || r.width === 0 || /^\s+$/u.test(parsed.graphemes[g])) return;
			const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
			const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
			if (dy < bestDy - 0.5 || (Math.abs(dy - bestDy) <= 0.5 && dx < bestDx)) {
				best = g;
				bestDy = dy;
				bestDx = dx;
			}
		});
		return best;
	}

	const segmentSpan = (g: number): Span => {
		const s = parsed.segments[parsed.segmentOf[g]];
		return { start: s.start, end: s.end };
	};
	const blank = (g: number) => /^\s+$/u.test(parsed.graphemes[g] ?? '');

	// ---- taps, holds and mouse drags on the text ----
	let press: { id: number; x: number; y: number; g: number; moved: boolean; long: boolean; mouse: boolean; timer?: ReturnType<typeof setTimeout> } | null = null;

	const gOf = (e: Event) => {
		const el = (e.target as HTMLElement).closest<HTMLElement>('[data-g]');
		return el ? Number(el.dataset.g) : null;
	};

	function down(e: PointerEvent) {
		if (disabled || e.button > 0) return;
		const g = gOf(e);
		if (g === null || blank(g)) return;
		const mouse = e.pointerType === 'mouse';
		press = { id: e.pointerId, x: e.clientX, y: e.clientY, g, moved: false, long: false, mouse };
		if (mouse) {
			box!.setPointerCapture(e.pointerId);
			cacheRects();
		} else {
			// Touch-and-hold picks out a single letter.
			press.timer = setTimeout(() => {
				if (!press || press.moved) return;
				press.long = true;
				selection = { start: g, end: g + 1 };
				navigator.vibrate?.(8);
			}, 450);
		}
	}

	function move(e: PointerEvent) {
		if (!press || press.id !== e.pointerId) return;
		if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) {
			press.moved = true;
			clearTimeout(press.timer);
		}
		// With a mouse, dragging across the text selects a run of words.
		if (press.mouse && press.moved) {
			const g = nearest(e.clientX, e.clientY);
			if (g === null) return;
			const a = segmentSpan(press.g);
			const b = segmentSpan(g);
			selection = { start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) };
		}
	}

	function up(e: PointerEvent) {
		if (!press || press.id !== e.pointerId) return;
		clearTimeout(press.timer);
		if (!press.moved && !press.long) selection = segmentSpan(press.g);
		press = null;
	}

	function cancel() {
		if (press) clearTimeout(press.timer);
		press = null;
	}

	// ---- dragging a handle ----
	let drag = $state<{ which: 'start' | 'end'; id: number; letters: boolean; lastP: number } | null>(null);
	let pointer = $state({ x: 0, y: 0 });
	let frame = 0;
	// The finger sits on the knob below the line; aim at the text above it.
	const lift = $derived(16 + lineHeight * 0.55);

	function handleDown(e: PointerEvent, which: 'start' | 'end') {
		if (disabled) return;
		e.stopPropagation();
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { which, id: e.pointerId, letters: false, lastP: which === 'end' ? selection!.end : selection!.start };
		pointer = { x: e.clientX, y: e.clientY };
		cacheRects();
		frame = requestAnimationFrame(autoScroll);
	}

	function handleMove(e: PointerEvent) {
		if (!drag || drag.id !== e.pointerId) return;
		pointer = { x: e.clientX, y: e.clientY };
		follow();
	}

	function handleUp(e: PointerEvent) {
		if (!drag || drag.id !== e.pointerId) return;
		drag = null;
		cancelAnimationFrame(frame);
	}

	// Like phone text selection: a drag starts out taking whole words, and switches to letter by
	// letter once she pulls the handle back inside the word it is in ("також", then "тако"). Moving
	// on into another word goes back to whole words. The mode lasts for the drag, so the handle
	// never flickers between the two.
	function follow() {
		if (!drag || !selection) return;
		const g = nearest(pointer.x, pointer.y - lift);
		if (g === null) return;
		const r = rects[g];
		// The boundary nearest the finger, counted in graphemes; works across lines too.
		const p = pointer.x > (r.left + r.right) / 2 ? g + 1 : g;
		const step = p - drag.lastP;
		drag.lastP = p;
		const seg = segmentSpan(g);
		if (drag.which === 'end') {
			const current = parsed.segmentOf[selection.end - 1];
			if (drag.letters && g >= selection.end && parsed.segmentOf[g] !== current) drag.letters = false;
			else if (!drag.letters && step < 0 && parsed.segmentOf[g] === current) drag.letters = true;
			let end = drag.letters ? p : blank(g) ? seg.start : seg.end;
			end = Math.max(end, selection.start + 1);
			if (end !== selection.end) selection = { start: selection.start, end };
		} else {
			const current = parsed.segmentOf[selection.start];
			if (drag.letters && g < selection.start && parsed.segmentOf[g] !== current) drag.letters = false;
			else if (!drag.letters && step > 0 && parsed.segmentOf[g] === current) drag.letters = true;
			let start = drag.letters ? p : blank(g) ? seg.end : seg.start;
			start = Math.min(start, selection.end - 1);
			if (start !== selection.start) selection = { start, end: selection.end };
		}
	}

	// Near the top, or near the docked picker at the bottom, the text scrolls under the handle.
	function autoScroll() {
		if (!drag) return;
		const top = 60;
		const bottom = innerHeight - bottomInset - 50;
		const dy = pointer.y < top ? -(top - pointer.y) / 3 : pointer.y > bottom ? (pointer.y - bottom) / 3 : 0;
		if (dy) {
			scrollBy(0, dy);
			cacheRects();
			follow();
		}
		frame = requestAnimationFrame(autoScroll);
	}

	// The magnifier: the text around the moving edge, large, above the finger.
	const lens = $derived.by(() => {
		if (!drag || !selection) return null;
		const at = drag.which === 'end' ? selection.end : selection.start;
		const from = Math.max(0, at - 12);
		const to = Math.min(parsed.graphemes.length, at + 12);
		const parts = [];
		for (let g = from; g <= to; g++) {
			if (g === at) parts.push({ caret: true, text: '', sel: false });
			if (g < to) parts.push({ caret: false, text: parsed.graphemes[g].replace(/\n/g, ' '), sel: g >= selection.start && g < selection.end });
		}
		return {
			parts,
			x: Math.min(innerWidth - 120, Math.max(120, pointer.x)),
			y: Math.max(8, pointer.y - lift - lineHeight - 64)
		};
	});
</script>

<div
	class="text"
	class:disabled
	bind:this={box}
	{lang}
	style="--size: {size}px; --lh: {lineHeight}px"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={cancel}
	role="presentation"
>
	{#each parsed.segments as seg, i (i)}<span class="seg">{#each { length: seg.end - seg.start } as _, k (k)}{@const g = seg.start + k}<span
					class="g"
					class:sel={selection && g >= selection.start && g < selection.end}
					class:done={covered[g]}
					data-g={g}
					>{parsed.graphemes[g]}</span
				>{/each}</span
		>{/each}

	{#if handles && selection}
		{#each ['start', 'end'] as const as which (which)}
			{@const p = handles[which]}
			<div
				class="handle {which}"
				class:active={drag?.which === which}
				style="left: {p.x}px; top: {p.y}px; --stem: {p.h}px"
				onpointerdown={(e) => handleDown(e, which)}
				onpointermove={handleMove}
				onpointerup={handleUp}
				onpointercancel={handleUp}
				role="slider"
				aria-label={which === 'start' ? 'Start of selection' : 'End of selection'}
				aria-valuenow={which === 'start' ? selection.start : selection.end}
				tabindex="-1"
			>
				<span class="stem"></span><span class="knob"></span>
			</div>
		{/each}
	{/if}
</div>

{#if lens}
	<div class="lens" style="left: {lens.x}px; top: {lens.y}px" aria-hidden="true">
		{#each lens.parts as p, i (i)}{#if p.caret}<span class="caret"></span>{:else}<span class:sel={p.sel}>{p.text}</span>{/if}{/each}
	</div>
{/if}

<style>
	.text {
		position: relative;
		font-size: var(--size);
		line-height: var(--lh);
		white-space: pre-wrap;
		overflow-wrap: break-word;
		/* No phone text selection, callout menu or double-tap zoom on the test text. */
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		touch-action: manipulation;
		cursor: pointer;
		/* Room under the last line for the handle knobs. */
		padding-bottom: 28px;
	}
	.text.disabled {
		cursor: default;
	}
	.g {
		border-radius: 2px;
	}
	/* Answered parts: a neutral underline, never her colour. */
	.g.done {
		text-decoration: underline 2px rgba(0, 0, 0, 0.55);
		text-underline-offset: 5px;
		text-decoration-skip-ink: none;
	}
	.g.sel {
		background: var(--syn-select, rgba(255, 255, 255, 0.55));
	}
	.handle {
		position: absolute;
		width: 44px;
		height: 44px;
		margin-left: -22px;
		touch-action: none;
		cursor: grab;
		z-index: 2;
	}
	.stem {
		position: absolute;
		left: 21px;
		bottom: 100%;
		width: 2px;
		height: var(--stem);
		background: #111;
	}
	.knob {
		position: absolute;
		left: 12px;
		top: 0;
		width: 20px;
		height: 20px;
		background: #111;
		border: 2px solid #fff;
		box-sizing: border-box;
	}
	/* Teardrops pointing at the selection. */
	.handle.start .knob {
		border-radius: 50% 0 50% 50%;
	}
	.handle.end .knob {
		border-radius: 0 50% 50% 50%;
	}
	.handle.active {
		cursor: grabbing;
	}
	.lens {
		position: fixed;
		z-index: 40;
		transform: translateX(-50%);
		max-width: 92vw;
		white-space: pre;
		overflow: hidden;
		padding: 8px 14px;
		font-size: 28px;
		line-height: 1.3;
		background: #d6d6d6;
		color: #111;
		border-radius: 12px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
		pointer-events: none;
	}
	.lens .sel {
		background: rgba(255, 255, 255, 0.85);
	}
	.lens .caret {
		display: inline-block;
		width: 2px;
		height: 1.1em;
		margin: 0 -1px;
		vertical-align: -0.15em;
		background: #000;
	}
</style>

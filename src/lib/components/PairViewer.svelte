<script lang="ts">
	import { flushSync, onMount } from 'svelte';
	import { fileUrl } from '#lib/urls';

	let {
		image
	}: {
		image: {
			title: string;
			sourceMode: 'single_file' | 'two_files';
			fileKey: string | null;
			leftKey: string | null;
			rightKey: string | null;
			leftW: number;
			leftH: number;
			rightW: number | null;
			rightH: number | null;
		};
	} = $props();

	const two = $derived(image.sourceMode === 'two_files');

	// View-only preferences, remembered per visitor in localStorage.
	let size = $state(100);
	let gap = $state(8);
	let outline = $state(true);
	let thickness = $state(8);
	let swapped = $state(false);
	let fullscreen = $state(false);

	let stage = $state<HTMLElement>();
	let box = $state({ w: 0, h: 0 });

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem('viewer') ?? '{}');
			if (typeof saved.size === 'number') size = saved.size;
			if (typeof saved.gap === 'number') gap = saved.gap;
			if (typeof saved.outline === 'boolean') outline = saved.outline;
			if (typeof saved.thickness === 'number') thickness = saved.thickness;
		} catch {
			// no saved preferences
		}
		const ro = new ResizeObserver(() => measure());
		if (stage) ro.observe(stage);
		window.addEventListener('resize', measure);
		measure();
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', measure);
		};
	});

	function measure() {
		if (!stage) return;
		box = {
			w: stage.clientWidth,
			h: fullscreen ? window.innerHeight : Math.round(window.innerHeight * 0.8)
		};
	}

	$effect(() => {
		const prefs = JSON.stringify({ size, gap, outline, thickness });
		try {
			localStorage.setItem('viewer', prefs);
		} catch {
			// private mode
		}
	});

	// Both images share one scale so their relative sizes stay true; the frame sits outside them.
	const layout = $derived.by(() => {
		if (!two || !box.w) return null;
		const b = outline ? thickness : 0;
		const lw = image.leftW;
		const lh = image.leftH;
		const rw = image.rightW ?? lw;
		const rh = image.rightH ?? lh;
		const room = { w: box.w - gap - 4 * b, h: box.h - 2 * b };
		const k = (Math.min(room.w / (lw + rw), room.h / Math.max(lh, rh)) * size) / 100;
		// maxW/maxH: how far a frame may grow when zoomed, its share of the whole stage.
		const dims = (w: number, h: number) => ({
			w: Math.max(1, Math.floor(w * k)),
			h: Math.max(1, Math.floor(h * k)),
			maxW: Math.max(1, Math.floor((w * room.w) / (lw + rw))),
			maxH: Math.max(1, Math.floor(room.h))
		});
		return { b, left: dims(lw, lh), right: dims(rw, rh) };
	});

	// Zoom and pan are shared by both images so the eyes keep fusing: one zoom factor and one
	// centre, as fractions of each image (0..1), so sides of different pixel sizes stay matched.
	// Zooming first grows each frame into the free stage space around it, then crops.
	type Pt = { x: number; y: number };
	type Dims = { w: number; h: number; maxW: number; maxH: number };
	// A screen point over the frame at display position i (0 = left).
	type Anchor = { i: number; client: Pt };
	type View = { z: number; x: number; y: number };
	const MAX_ZOOM = 8;
	const STEP = 1.5;
	let view = $state<View>({ z: 1, x: 0.5, y: 0.5 });
	let pairEl = $state<HTMLElement>();
	const frames = $state<HTMLElement[]>([]);

	const frameSize = (d: Dims, z: number) => ({ w: Math.min(d.w * z, d.maxW), h: Math.min(d.h * z, d.maxH) });

	// Keeps the centre far enough from the edges that neither frame shows past its image.
	function clampView(v: View): View {
		if (!layout) return v;
		let hx = 0;
		let hy = 0;
		for (const d of [layout.left, layout.right]) {
			const f = frameSize(d, v.z);
			hx = Math.max(hx, f.w / (2 * d.w * v.z));
			hy = Math.max(hy, f.h / (2 * d.h * v.z));
		}
		const c = (n: number, h: number) => Math.min(1 - h, Math.max(h, n));
		return { z: v.z, x: c(v.x, hx), y: c(v.y, hy) };
	}
	// Re-clamped on render too, so resizing the window or the size slider never shows past an edge.
	const shown = $derived(clampView(view));
	const zoomed = $derived(shown.z > 1.001);
	const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(1, z));

	// Mean offset of the anchors from their frames' centres, in image fractions at zoom z.
	function offset(anchors: Anchor[], z: number): Pt {
		let x = 0;
		let y = 0;
		for (const a of anchors) {
			const f = frames[a.i];
			const r = f.getBoundingClientRect();
			const d = order[a.i].d;
			x += (a.client.x - (r.left + f.clientLeft + f.clientWidth / 2)) / (d.w * z);
			y += (a.client.y - (r.top + f.clientTop + f.clientHeight / 2)) / (d.h * z);
		}
		return { x: x / anchors.length, y: y / anchors.length };
	}

	// Sets the zoom to z, keeping the image point under `from` under `to` (the same pointers,
	// before and after they moved).
	function moveView(from: Anchor[], to: Anchor[], z: number) {
		const v = shown;
		const a = offset(from, v.z);
		z = clampZoom(z);
		view = clampView({ z, x: v.x, y: v.y });
		// Frames may have grown and shifted; measure them where they are now.
		flushSync();
		const b = offset(to, z);
		view = clampView({ z, x: v.x + a.x - b.x, y: v.y + a.y - b.y });
	}
	function zoomBy(f: number, at?: Anchor[]) {
		if (at) moveView(at, at, shown.z * f);
		else view = clampView({ ...shown, z: clampZoom(shown.z * f) });
	}
	const resetZoom = () => (view = { z: 1, x: 0.5, y: 0.5 });
	const toggleZoom = (at: Anchor[]) => (zoomed ? resetZoom() : moveView(at, at, 2.5));

	// Each pointer is measured against the frame it started on, so a pinch with one finger on
	// each image works as well as one on a single image.
	const pointers = new Map<number, Anchor>();
	let gesture: { at: Anchor[]; dist: number } | null = null;
	let tap: { t: number; client: Pt } | null = null;
	let lastTap: { t: number; client: Pt } | null = null;

	function readGesture() {
		const at = [...pointers.values()].slice(0, 2).map((p) => ({ i: p.i, client: { ...p.client } }));
		if (!at.length) return null;
		return {
			at,
			dist: at.length === 2 ? Math.hypot(at[0].client.x - at[1].client.x, at[0].client.y - at[1].client.y) : 0
		};
	}

	function onPointerDown(e: PointerEvent, i: number) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		const client = { x: e.clientX, y: e.clientY };
		pointers.set(e.pointerId, { i, client });
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		gesture = readGesture();
		tap = pointers.size === 1 ? { t: e.timeStamp, client } : null;
	}

	function onPointerMove(e: PointerEvent) {
		const p = pointers.get(e.pointerId);
		if (!p) return;
		p.client = { x: e.clientX, y: e.clientY };
		if (tap && Math.hypot(p.client.x - tap.client.x, p.client.y - tap.client.y) > 10) tap = null;
		const next = readGesture();
		if (gesture && next && (zoomed || pointers.size > 1)) {
			const f = gesture.dist && next.dist ? next.dist / gesture.dist : 1;
			moveView(gesture.at, next.at, shown.z * f);
		}
		gesture = next;
	}

	function onPointerUp(e: PointerEvent) {
		const p = pointers.get(e.pointerId);
		if (!p) return;
		pointers.delete(e.pointerId);
		gesture = readGesture();
		// Double-tap on touch screens; mice use dblclick.
		if (e.type !== 'pointerup' || e.pointerType === 'mouse' || !tap || e.timeStamp - tap.t > 300) return;
		const here = { t: e.timeStamp, client: p.client };
		if (lastTap && here.t - lastTap.t < 350 && Math.hypot(here.client.x - lastTap.client.x, here.client.y - lastTap.client.y) < 30) {
			toggleZoom([{ i: p.i, client: here.client }]);
			lastTap = null;
		} else lastTap = here;
		tap = null;
	}

	// Ctrl/Cmd + wheel (also what a trackpad pinch sends) zooms; in fullscreen the plain wheel does,
	// since there is no page to scroll. Registered by hand because it must be able to preventDefault.
	$effect(() => {
		const el = pairEl;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			const frame = (e.target as HTMLElement).closest<HTMLElement>('.frame');
			const i = frame ? frames.indexOf(frame) : -1;
			if (i < 0 || !(e.ctrlKey || e.metaKey || fullscreen)) return;
			e.preventDefault();
			const dy = Math.max(-100, Math.min(100, e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY));
			zoomBy(Math.exp(-dy * 0.004), [{ i, client: { x: e.clientX, y: e.clientY } }]);
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	});

	const urls = $derived(
		two
			? { a: fileUrl(image.leftKey!), b: fileUrl(image.rightKey!) }
			: { a: fileUrl(image.fileKey!), b: '' }
	);
	const order = $derived(
		layout
			? swapped
				? [
						{ src: urls.b, d: layout.right },
						{ src: urls.a, d: layout.left }
					]
				: [
						{ src: urls.a, d: layout.left },
						{ src: urls.b, d: layout.right }
					]
			: []
	);

	// iPhone Safari cannot fullscreen page elements, so fall back to a fixed full-window overlay.
	let overlay = $state(false);

	async function toggleFullscreen() {
		if (document.fullscreenElement) return void (await document.exitFullscreen());
		if (overlay) {
			overlay = false;
			fullscreen = false;
		} else {
			try {
				await stage!.requestFullscreen();
			} catch {
				overlay = true;
				fullscreen = true;
			}
		}
		queueMicrotask(measure);
	}

	function onFullscreenChange() {
		fullscreen = !!document.fullscreenElement;
		queueMicrotask(measure);
	}

	function onKey(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		const t = e.target as HTMLElement;
		if (t.closest('input, textarea, select, [contenteditable]')) return;
		switch (e.key) {
			case 'f':
			case 'F':
				void toggleFullscreen();
				break;
			case 'o':
			case 'O':
				if (two) outline = !outline;
				break;
			case 's':
			case 'S':
				if (two) swapped = !swapped;
				break;
			case '+':
			case '=':
				if (two) zoomBy(STEP);
				break;
			case '-':
			case '_':
				if (two) zoomBy(1 / STEP);
				break;
			case '0':
				if (two) resetZoom();
				break;
			default:
				return;
		}
		e.preventDefault();
	}
</script>

<svelte:window onkeydown={onKey} />
<svelte:document onfullscreenchange={onFullscreenChange} />

<!-- While zoomed, a horizontal drag pans instead of swiping to the next pair. -->
<div class="stage" class:full={fullscreen} class:overlay data-swipe={zoomed ? undefined : ''} bind:this={stage} style="--b: {layout?.b ?? 0}px; --gap: {gap}px">
	{#if two && layout}
		<div class="pair" class:zoomed bind:this={pairEl}>
			{#each order as o, i (i)}
				{@const fs = frameSize(o.d, shown.z)}
				<div
					class="frame"
					role="presentation"
					bind:this={frames[i]}
					style="width: {fs.w}px; height: {fs.h}px"
					onpointerdown={(e) => onPointerDown(e, i)}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
					onpointercancel={onPointerUp}
					ondblclick={(e) => toggleZoom([{ i, client: { x: e.clientX, y: e.clientY } }])}
				>
					<img
						src={o.src}
						alt="{image.title}, {i === 0 ? 'left' : 'right'} image"
						width={o.d.w}
						height={o.d.h}
						draggable="false"
						style="transform: translate({fs.w / 2 - shown.x * o.d.w * shown.z}px, {fs.h / 2 - shown.y * o.d.h * shown.z}px) scale({shown.z})"
					/>
				</div>
			{/each}
		</div>
	{:else if two}
		<div class="pair">
			<img src={urls.a} alt="{image.title}, left image" />
			<img src={urls.b} alt="{image.title}, right image" />
		</div>
	{:else}
		<img class="single" src={urls.a} alt={image.title} />
	{/if}
	{#if fullscreen}
		<button type="button" class="exit" onclick={toggleFullscreen} aria-label="Exit fullscreen">✕</button>
	{/if}
</div>

<div class="controls">
	<div class="row">
	<button type="button" onclick={toggleFullscreen} title="Fullscreen (F)">Fullscreen</button>
	{#if two}
		<button type="button" onclick={() => (swapped = !swapped)} class:active={swapped} title="Swap sides (S)">
			Swap sides
		</button>
		<button type="button" onclick={() => (outline = !outline)} class:active={outline} title="Fusion outline (O)">
			Outline
		</button>
		<label class="inline small">
			Thickness
			<input type="range" min="1" max="40" bind:value={thickness} disabled={!outline} />
			<span class="muted">{thickness}px</span>
		</label>
		<label class="inline small">
			Size
			<input type="range" min="20" max="100" bind:value={size} />
			<span class="muted">{size}%</span>
		</label>
		<label class="inline small">
			Gap
			<input type="range" min="0" max="200" bind:value={gap} />
			<span class="muted">{gap}px</span>
		</label>
		<span class="zoom small">
			Zoom
			<button type="button" onclick={() => zoomBy(1 / STEP)} disabled={!zoomed} aria-label="Zoom out (−)" title="Zoom out (−)">−</button>
			<span class="muted">{Math.round(shown.z * 100)}%</span>
			<button type="button" onclick={() => zoomBy(STEP)} disabled={shown.z >= MAX_ZOOM} aria-label="Zoom in (+)" title="Zoom in (+)">+</button>
			<button type="button" onclick={resetZoom} disabled={!zoomed} title="Reset zoom (0)">Reset</button>
		</span>
	{/if}
	</div>
	<p class="keys muted small">
		← → previous/next · F fullscreen{two
			? ' · O outline · S swap sides · + − 0 zoom · Ctrl+scroll to zoom, drag to pan'
			: ''}
	</p>
	{#if two}
		<p class="touch-hint muted small">Pinch to zoom · double-tap to zoom in or out</p>
	{/if}
</div>

<style>
	.stage {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		background: var(--bg);
	}
	.stage {
		position: relative;
	}
	.stage.full {
		height: 100vh;
		height: 100dvh;
	}
	.stage.overlay {
		position: fixed;
		inset: 0;
		z-index: 60;
		width: auto;
	}
	.exit {
		position: absolute;
		top: 0.6em;
		right: 0.6em;
		opacity: 0.6;
	}
	.stage:not(.overlay) .exit {
		display: none;
	}
	.pair {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--gap);
	}
	/* The frame clips the zoomed image and carries the outline, which stays put while zooming. */
	.frame {
		flex: none;
		overflow: hidden;
		border: var(--b) solid var(--frame);
		box-sizing: content-box;
		/* Vertical page scroll still works when not zoomed; pinches come to us instead of zooming the page. */
		touch-action: pan-y;
	}
	.zoomed .frame {
		touch-action: none;
		cursor: grab;
	}
	.zoomed .frame:active {
		cursor: grabbing;
	}
	.pair img {
		display: block;
		transform-origin: 0 0;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.single {
		display: block;
		max-width: 100%;
		max-height: 80vh;
		object-fit: contain;
	}
	.stage.full .single {
		max-width: 100vw;
		max-height: 100vh;
	}
	.controls {
		margin: 0.6em 0 0;
		padding: 0.6em 0.8em;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.controls .row {
		gap: 0.6em 1.2em;
	}
	.keys,
	.touch-hint {
		margin: 0.5em 0 0;
	}
	.touch-hint {
		display: none;
	}
	@media (hover: none) {
		.keys {
			display: none;
		}
		.touch-hint {
			display: block;
		}
	}
	.zoom {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		color: var(--muted);
	}
	.zoom button {
		padding: 0.15em 0.6em;
	}
	input[type='range'] {
		width: 8em;
	}
</style>

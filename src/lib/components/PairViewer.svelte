<script lang="ts">
	import { onMount } from 'svelte';
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
		const k =
			(Math.min((box.w - gap - 4 * b) / (lw + rw), (box.h - 2 * b) / Math.max(lh, rh)) * size) /
			100;
		const dims = (w: number, h: number) => ({ w: Math.max(1, Math.floor(w * k)), h: Math.max(1, Math.floor(h * k)) });
		return { b, left: dims(lw, lh), right: dims(rw, rh) };
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
			default:
				return;
		}
		e.preventDefault();
	}
</script>

<svelte:window onkeydown={onKey} />
<svelte:document onfullscreenchange={onFullscreenChange} />

<div class="stage" class:full={fullscreen} class:overlay data-swipe bind:this={stage} style="--b: {layout?.b ?? 0}px; --gap: {gap}px">
	{#if two && layout}
		<div class="pair">
			{#each order as o, i (i)}
				<img src={o.src} alt="{image.title}, {i === 0 ? 'left' : 'right'} image" width={o.d.w} height={o.d.h} />
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
	{/if}
	</div>
	<p class="keys muted small">
		← → previous/next · F fullscreen{two ? ' · O outline · S swap sides' : ''}
	</p>
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
	.pair img {
		display: block;
		flex: none;
		border: var(--b) solid var(--frame);
		box-sizing: content-box;
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
	.keys {
		margin: 0.5em 0 0;
	}
	@media (hover: none) {
		.keys {
			display: none;
		}
	}
	input[type='range'] {
		width: 8em;
	}
</style>

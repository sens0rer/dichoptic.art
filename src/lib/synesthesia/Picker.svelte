<script lang="ts">
	import { css, vivid } from './okhsl';

	// Okhsl, each 0..1. Hue on the ring, saturation and lightness on the sliders.
	let { h = $bindable(0), s = $bindable(0), l = $bindable(0.5) }: { h: number; s: number; l: number } = $props();

	// The ring shows every hue at its most saturated, so hues are easy to find whatever the
	// sliders say; the centre shows the colour actually chosen.
	const ring = Array.from({ length: 73 }, (_, i) => `${vivid(i / 72)} ${i * 5}deg`).join(', ');
	const stops = (f: (t: number) => string) =>
		Array.from({ length: 11 }, (_, i) => `${f(i / 10)} ${i * 10}%`).join(', ');
	const satTrack = $derived(`linear-gradient(to right, ${stops((t) => css(h, t, l))})`);
	const lightTrack = $derived(`linear-gradient(to right, ${stops((t) => css(h, s, t))})`);
	const current = $derived(css(h, s, l));

	let wheel = $state<HTMLElement>();

	function setHue(e: PointerEvent) {
		const r = wheel!.getBoundingClientRect();
		const angle = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2)));
		h = ((angle / (2 * Math.PI)) % 1 + 1) % 1;
	}

	function down(e: PointerEvent) {
		wheel!.setPointerCapture(e.pointerId);
		setHue(e);
	}
	const move = (e: PointerEvent) => wheel!.hasPointerCapture(e.pointerId) && setHue(e);

	// Arrow keys on the ring step the hue, for keyboard use.
	function key(e: KeyboardEvent) {
		const step = e.shiftKey ? 0.05 : 0.01;
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') h = (h + step) % 1;
		else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') h = (h - step + 1) % 1;
		else return;
		e.preventDefault();
	}
</script>

<div class="picker">
	<div
		class="wheel"
		bind:this={wheel}
		style="background: conic-gradient({ring})"
		role="slider"
		tabindex="0"
		aria-label="Hue"
		aria-valuemin="0"
		aria-valuemax="360"
		aria-valuenow={Math.round(h * 360)}
		onpointerdown={down}
		onpointermove={move}
		onkeydown={key}
	>
		<div class="centre" style="background: {current}"></div>
		<div class="marker" style="transform: rotate({h * 360}deg)"><span></span></div>
	</div>
	<div class="sliders">
		<label>
			<span>Saturation</span>
			<input type="range" min="0" max="1" step="0.001" bind:value={s} style="background: {satTrack}" />
		</label>
		<label>
			<span>Lightness</span>
			<input type="range" min="0" max="1" step="0.001" bind:value={l} style="background: {lightTrack}" />
		</label>
	</div>
</div>

<style>
	.picker {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.wheel {
		--size: var(--wheel, 128px);
		position: relative;
		flex: none;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		touch-action: none;
		cursor: crosshair;
	}
	.wheel:focus-visible {
		outline: 2px solid #111;
		outline-offset: 3px;
	}
	.centre {
		position: absolute;
		inset: 22%;
		border-radius: 50%;
		box-shadow: 0 0 0 3px var(--syn-bg, #8a8a8a);
	}
	.marker {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.marker span {
		position: absolute;
		left: 50%;
		top: 1px;
		width: 18px;
		height: 18px;
		margin-left: -9px;
		border-radius: 50%;
		border: 3px solid #fff;
		box-shadow: 0 0 0 1.5px #000;
	}
	.sliders {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 10px;
	}
	label {
		display: grid;
		gap: 4px;
		margin: 0;
		font-size: 0.8rem;
		color: var(--syn-muted, #333);
	}
	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 30px;
		border-radius: 15px;
		border: 1px solid rgba(0, 0, 0, 0.35);
		padding: 0;
		margin: 0;
		touch-action: none;
	}
	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: transparent;
		border: 4px solid #fff;
		box-shadow: 0 0 0 1.5px #000;
	}
	input[type='range']::-moz-range-thumb {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: transparent;
		border: 4px solid #fff;
		box-shadow: 0 0 0 1.5px #000;
	}
	input[type='range']:focus-visible {
		outline: 2px solid #111;
		outline-offset: 2px;
	}
</style>

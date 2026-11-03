<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { colour as makeColour, type Colour } from '#lib/synesthesia/okhsl';
	import { outbox, sendReverse, startOutbox, uid } from '#lib/synesthesia/outbox.svelte';

	let { data } = $props();

	// A random colour in Okhsl: every hue equally likely; saturation leaning towards vivid
	// (1 − (1 − u)³, mean 0.75); lightness leaning towards the middle (the mean of two draws,
	// spread over 0.15–0.85), so few near-greys, near-blacks and near-whites.
	const draw = () => {
		const r = Math.random;
		const s = 1 - (1 - r()) ** 3;
		const l = 0.15 + 0.7 * ((r() + r()) / 2);
		return makeColour(r(), s, l);
	};

	// Not too close to the previous colour: redraw while the Oklab distance is under 0.15 (about
	// seven just-noticeable differences), giving up after a few tries.
	const distance = (a: Colour, b: Colour) => Math.hypot(a.lab[0] - b.lab[0], a.lab[1] - b.lab[1], a.lab[2] - b.lab[2]);
	function random() {
		let c = draw();
		for (let i = 0; current && i < 30 && distance(c, current) < 0.15; i++) c = draw();
		return c;
	}

	let current = $state<Colour | null>(null);
	let text = $state('');
	let count = $state(0);
	let shownAt = 0;
	let input = $state<HTMLInputElement>();

	async function next() {
		current = random();
		text = '';
		shownAt = performance.now();
		await tick();
		input?.focus({ preventScroll: true });
	}

	onMount(() => {
		count = data.answered;
		startOutbox();
		void next();
	});

	function answer(nothing: boolean) {
		if (!current || (!nothing && !text.trim())) return;
		sendReverse({
			clientId: uid(),
			colour: current,
			text: nothing ? null : text.trim(),
			nothing,
			answeredAt: new Date().toISOString(),
			tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
			shownMs: Math.round(performance.now() - shownAt)
		});
		count++;
		void next();
	}
</script>

<svelte:head><title>Reverse test · Colour tests</title></svelte:head>

<main>
	<div class="top">
		<a href="/synesthesia">← Tests</a>
		<span class="muted">{count} answered · {outbox.pending ? `${outbox.pending} unsent` : 'Saved'}</span>
	</div>
	<p class="ask">Write something that has this colour: a letter, a word, a number, anything.</p>
	<div class="swatch" style="background: {current?.hex ?? 'transparent'}"></div>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			answer(false);
		}}
	>
		<input bind:this={input} bind:value={text} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type here" />
		<div class="buttons">
			<button class="primary" disabled={!text.trim()}>Save</button>
			<button type="button" onclick={() => answer(true)}>Nothing</button>
		</div>
	</form>
</main>

<style>
	main {
		max-width: 560px;
		margin: 0 auto;
		padding: 16px 16px 32px;
		display: grid;
		gap: 14px;
	}
	.top {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
	}
	.muted {
		color: var(--syn-muted);
		font-size: 0.85rem;
	}
	.ask {
		margin: 0;
	}
	/* Large, so the colour is seen as a surface, with the grey surround around it. */
	.swatch {
		width: 100%;
		aspect-ratio: 4 / 3;
		max-height: 45dvh;
		border-radius: 12px;
	}
	form {
		display: grid;
		gap: 10px;
	}
	input {
		font-size: 1.2rem;
		padding: 0.6em 0.8em;
	}
	.buttons {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 10px;
	}
	.buttons button {
		padding: 0.7em;
	}
</style>

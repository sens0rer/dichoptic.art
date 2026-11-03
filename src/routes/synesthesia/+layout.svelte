<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
	<title>Colour tests</title>
</svelte:head>

<div class="syn">
	{@render children()}
</div>

<style>
	/* A neutral mid-grey surround, so colours are judged against nothing in particular. */
	:global(html:has(.syn)),
	:global(body:has(.syn)) {
		background: var(--syn-bg);
		color-scheme: light;
	}
	.syn {
		--syn-bg: #8a8a8a;
		--syn-text: #111;
		--syn-muted: #333;
		--syn-surface: #9a9a9a;
		--syn-line: #6f6f6f;
		--syn-select: rgba(255, 255, 255, 0.55);
		min-height: 100dvh;
		background: var(--syn-bg);
		color: var(--syn-text);
	}
	.syn :global(button),
	.syn :global(.btn) {
		background: var(--syn-surface);
		color: var(--syn-text);
		border-color: var(--syn-line);
	}
	.syn :global(button:hover:not(:disabled)),
	.syn :global(.btn:hover) {
		border-color: #444;
	}
	.syn :global(button.primary) {
		background: #222;
		color: #eee;
		border-color: #222;
	}
	.syn :global(a) {
		color: #102a5c;
	}
	.syn :global(textarea),
	.syn :global(input:not([type='range'])) {
		background: #b4b4b4;
		color: var(--syn-text);
		border-color: var(--syn-line);
	}
</style>

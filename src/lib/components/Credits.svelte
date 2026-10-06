<script lang="ts">
	import LinkedText from './LinkedText.svelte';

	// Fixed locale and zone so server and browser render the same text.
	const formatDay = (d: string) =>
		new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});

	let {
		credit,
		submittedBy,
		author,
		date = null
	}: {
		date?: string | null;
		credit: string | null;
		submittedBy: string | null;
		author: string | null;
	} = $props();
</script>

{#if credit || submittedBy || author || date}
	<dl class="credits">
		{#if date}
			<dt>Date</dt>
			<dd>{formatDay(date)}</dd>
		{/if}
		{#if credit}
			<dt>Credit</dt>
			<dd>
				<LinkedText text={credit} />
			</dd>
		{/if}
		{#if author}
			<dt>Author</dt>
			<dd>{author}</dd>
		{/if}
		{#if submittedBy}
			<dt>Submitted by</dt>
			<dd><a href="/by/{encodeURIComponent(submittedBy.trim().replace(/\s+/g, ' ').toLowerCase())}">{submittedBy}</a></dd>
		{/if}
	</dl>
{/if}

<style>
	.credits {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 0.2em 1em;
		margin: 0 0 1em;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		font-weight: 500;
	}
</style>

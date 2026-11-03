<script lang="ts">
	import ResultText from '#lib/synesthesia/ResultText.svelte';
	import { parse, type UnitKind } from '#lib/synesthesia/segment';

	let { data } = $props();

	const RTL = new Set(['ar', 'he']);
	const parsed = $derived(parse(data.stimulus.body, data.stimulus.unit as UnitKind, data.stimulus.lang));
	const size = $derived(data.stimulus.unit === 'char' ? 36 : data.stimulus.unit === 'math' ? 30 : 22);
	const slice = (start: number, end: number) => parsed.graphemes.slice(start, end).join('');
	const date = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head><title>Result · Colour tests</title></svelte:head>

<main>
	<div class="top">
		<a href="/synesthesia/results">← Results</a>
		<span class="muted">{data.stimulus.category}</span>
	</div>
	{#if data.stimulus.title}<h1>{data.stimulus.title}</h1>{/if}

	{#each data.attempts as a, i (a.id)}
		{@const notes = a.answers.filter((n) => n.note)}
		<section>
			<h2>{a.retest ? `Retest ${i}` : 'First time'} <span class="muted">· {date(a.finishedAt)}</span></h2>
			<ResultText
				{parsed}
				answers={a.answers}
				math={data.stimulus.unit === 'math' ? data.stimulus.body : null}
				lang={data.stimulus.lang}
				rtl={RTL.has(data.stimulus.lang ?? '')}
				{size}
			/>
			{#if notes.length}
				<ul class="notes">
					{#each notes as n, k (k)}
						<li><strong lang={data.stimulus.lang}>{slice(n.start, n.end)}</strong>: {n.note}</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
	<p class="legend muted">Dashed underline or outline: marked as no colour.</p>
</main>

<style>
	main {
		max-width: 820px;
		margin: 0 auto;
		padding: 16px 16px 48px;
	}
	.top {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		margin-bottom: 12px;
	}
	h1 {
		font-size: 1.2rem;
	}
	h2 {
		font-size: 1rem;
		margin: 1.4em 0 0.5em;
	}
	section {
		padding-bottom: 12px;
		border-bottom: 1px solid var(--syn-line);
	}
	.muted {
		color: var(--syn-muted);
		font-weight: normal;
		font-size: 0.85rem;
	}
	.notes {
		margin: 10px 0 0;
		padding-left: 1.2em;
		font-size: 0.9rem;
	}
	.legend {
		margin-top: 1.2em;
	}
</style>

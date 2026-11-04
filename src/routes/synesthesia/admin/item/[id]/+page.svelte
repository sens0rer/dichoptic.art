<script lang="ts">
	import { enhance } from '$app/forms';
	import ResultText from '#lib/synesthesia/ResultText.svelte';
	import { parse, type UnitKind } from '#lib/synesthesia/segment';

	let { data } = $props();

	const RTL = new Set(['ar', 'he']);
	const parsed = $derived(parse(data.item.body, data.item.unit as UnitKind, data.item.lang));
	const size = $derived(data.item.unit === 'char' ? 32 : data.item.unit === 'math' ? 26 : 20);
	const slice = (start: number, end: number) => parsed.graphemes.slice(start, end).join(data.item.unit === 'math' ? ' ' : '');
	const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '–');
	const sourceText = $derived(JSON.stringify(data.item.source, null, 2));
</script>

<svelte:head><title>{data.item.title ?? 'Item'} · Admin</title></svelte:head>

<main>
	<div class="top"><a href="/synesthesia/admin/{data.item.category.id}">← {data.item.category.name}</a></div>
	<div class="head">
		<h1>{data.item.title ?? 'Item'}</h1>
		<form method="post" action="?/hidden" use:enhance>
			<input type="hidden" name="hidden" value={String(!data.item.hidden)} />
			<button>{data.item.hidden ? 'Unhide' : 'Hide from new rounds'}</button>
		</form>
	</div>
	<p class="muted">
		{data.item.category.name}{data.item.lang ? ` · ${data.item.lang}` : ''} · parts: {data.item.unit === 'word' ? 'words' : data.item.unit === 'char' ? 'letters' : 'symbols'}
		· added {when(data.item.createdAt)}{#if data.item.hidden} · <strong>hidden</strong>{/if}
	</p>

	<h2>As shown</h2>
	{#if data.item.unit === 'math'}
		<div class="text math">{@html data.item.body}</div>
	{:else}
		<div class="text" class:letters={data.item.unit === 'char'} lang={data.item.lang} dir={RTL.has(data.item.lang ?? '') ? 'rtl' : 'ltr'}>{data.item.body}</div>
	{/if}

	<h2>Use</h2>
	{#if data.usage.length}
		<table>
			<thead><tr><th>Participant</th><th>Attempts</th><th>Finished</th><th>Retests</th><th>Answers</th><th>Last answer</th></tr></thead>
			<tbody>
				{#each data.usage as u (u.participant_id)}
					<tr>
						<td><code>{u.participant_id}</code></td>
						<td>{u.attempts}</td>
						<td>{u.finished}</td>
						<td>{u.retests}</td>
						<td>{u.answers}</td>
						<td>{when(u.last)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="muted">Not shown to anyone yet.</p>
	{/if}

	<h2>Answers</h2>
	{#if data.results.length}
		{#each data.results as a (a.id)}
			{@const notes = a.answers.filter((n) => n.note)}
			<section class="result" id="a-{a.id}">
				<p class="muted">
					<a href="/synesthesia/admin/participant/{a.participantId}"><code>{a.participantId}</code></a>
					· {a.retest ? 'retest' : 'first time'} · {a.finished ? `finished ${when(a.finished)}` : `started ${when(a.started)}, unfinished`}
					· {a.devices.join(', ')}
				</p>
				<ResultText
					{parsed}
					answers={a.answers}
					math={data.item.unit === 'math' ? data.item.body : null}
					lang={data.item.lang}
					rtl={RTL.has(data.item.lang ?? '')}
					{size}
				/>
				{#if notes.length}
					<ul class="notes">
						{#each notes as n, k (k)}<li><strong lang={data.item.lang}>{slice(n.start, n.end)}</strong>: {n.note}</li>{/each}
					</ul>
				{/if}
			</section>
		{/each}
		<p class="muted">Dashed underline or outline: marked as no colour. Unmarked parts are plain.</p>
	{:else}
		<p class="muted">No answers yet.</p>
	{/if}

	<h2>Source</h2>
	<pre>{sourceText}</pre>
	<p class="muted">Item id <code>{data.item.id}</code> (a hash of its content: the text never changes).</p>
</main>

<style>
	main {
		max-width: 900px;
		margin: 0 auto;
		padding: 16px 16px 48px;
	}
	.top {
		font-size: 0.9rem;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	h1 {
		font-size: 1.3rem;
		margin: 0.4em 0;
	}
	h2 {
		font-size: 1rem;
		margin: 1.4em 0 0.5em;
	}
	.muted {
		color: var(--syn-muted);
		font-size: 0.85rem;
	}
	.text {
		white-space: pre-wrap;
		font-size: 20px;
		line-height: 1.7;
		padding: 14px 16px;
		background: var(--syn-surface);
		border-radius: 10px;
	}
	.text.letters {
		font-size: 32px;
	}
	.text.math {
		white-space: normal;
		font-size: 26px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
		display: block;
		overflow-x: auto;
	}
	th,
	td {
		text-align: left;
		padding: 6px 8px;
		border-bottom: 1px solid var(--syn-line);
		white-space: nowrap;
	}
	.result {
		padding: 10px 0 14px;
		border-bottom: 1px solid var(--syn-line);
	}
	.result p {
		margin: 0 0 6px;
	}
	.notes {
		margin: 8px 0 0;
		padding-left: 1.2em;
		font-size: 0.9rem;
	}
	pre {
		font-size: 0.8rem;
		padding: 10px 12px;
		background: var(--syn-surface);
		border-radius: 8px;
		overflow-x: auto;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>

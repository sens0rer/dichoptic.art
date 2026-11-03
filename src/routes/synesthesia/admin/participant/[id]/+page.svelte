<script lang="ts">
	let { data } = $props();
	const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head><title>Participant · Admin</title></svelte:head>

<main>
	<div class="top"><a href="/synesthesia/export">← Participants</a> · <a href="/synesthesia/admin">Items</a></div>
	<h1>Participant <code>{data.id}</code></h1>
	<p class="muted">First answer {when(data.since)}. Each item opens with this participant's answers drawn in their colours.</p>

	{#each data.groups as g (g.name)}
		<h2>{g.name}</h2>
		<ul>
			{#each g.items as i (i.attemptId)}
				<li>
					<a href="/synesthesia/admin/item/{i.stimulusId}#a-{i.attemptId}">{i.preview}</a>
					<span class="muted">
						{i.retest ? 'retest · ' : ''}{i.answers} answer{i.answers === 1 ? '' : 's'} · {i.finished ? `finished ${when(i.finished)}` : 'unfinished'}
					</span>
				</li>
			{/each}
		</ul>
	{/each}

	{#if data.reverse.length}
		<h2>Reverse test</h2>
		<ul class="reverse">
			{#each data.reverse as r (r.id)}
				<li>
					<span class="swatch" style="background: {r.hex}"></span>
					<span>{r.nothing ? '— nothing —' : r.text}</span>
					<span class="muted">{r.hex} · {when(r.at)}</span>
				</li>
			{/each}
		</ul>
	{/if}
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
	h1 {
		font-size: 1.3rem;
		overflow-wrap: anywhere;
	}
	h2 {
		font-size: 1.05rem;
		margin-top: 1.4em;
	}
	.muted {
		color: var(--syn-muted);
		font-size: 0.85rem;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	li {
		min-width: 0;
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--syn-line);
	}
	li a {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	li .muted {
		flex: none;
	}
	.reverse li {
		justify-content: flex-start;
		align-items: center;
	}
	.reverse .muted {
		margin-left: auto;
	}
	.swatch {
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 6px;
	}
</style>

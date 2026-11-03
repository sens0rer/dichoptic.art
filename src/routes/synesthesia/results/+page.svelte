<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Results · Colour tests</title></svelte:head>

<main>
	<div class="top"><a href="/synesthesia">← Tests</a></div>
	<h1>Results</h1>
	{#if !data.groups.length}
		<p>Nothing finished yet. Items appear here once every part of them is marked.</p>
	{/if}
	{#each data.groups as g (g.name)}
		<h2>{g.name}</h2>
		<ul>
			{#each g.items as item (item.id)}
				<li>
					<a href="/synesthesia/results/{item.id}">{item.title ?? item.preview}</a>
					{#if item.retests}<span class="muted">{item.retests} retest{item.retests > 1 ? 's' : ''}</span>{/if}
				</li>
			{/each}
		</ul>
	{/each}
</main>

<style>
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: 16px 16px 48px;
	}
	.top {
		font-size: 0.9rem;
		margin-bottom: 12px;
	}
	h1 {
		font-size: 1.6rem;
	}
	h2 {
		font-size: 1.05rem;
		margin-top: 1.4em;
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
	.muted {
		flex: none;
		color: var(--syn-muted);
		font-size: 0.8rem;
	}
</style>

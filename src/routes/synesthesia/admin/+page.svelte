<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Admin · Colour tests</title></svelte:head>

<main>
	<div class="top"><a href="/synesthesia">← Tests</a> · <a href="/synesthesia/export">Export and participants</a></div>
	<h1>Items</h1>
	<p class="muted">Every pool, with how much it has been used (all browsers, test visits included).</p>
	<table>
		<thead>
			<tr><th>Category</th><th>Items</th><th>Hidden</th><th>Languages</th><th>Attempts</th><th>Answers</th></tr>
		</thead>
		<tbody>
			{#each data.categories as c (c.id)}
				<tr>
					<td><a href="/synesthesia/admin/{c.id}">{c.name}</a></td>
					<td>{c.items}</td>
					<td>{c.hidden || ''}</td>
					<td class="muted">{c.langs ?? '–'}</td>
					<td>{c.attempts}</td>
					<td>{c.answers}</td>
				</tr>
			{/each}
		</tbody>
	</table>
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
		font-size: 1.4rem;
	}
	.muted {
		color: var(--syn-muted);
		font-size: 0.85rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
		display: block;
		overflow-x: auto;
	}
	th,
	td {
		text-align: left;
		padding: 8px;
		border-bottom: 1px solid var(--syn-line);
		white-space: nowrap;
	}
</style>

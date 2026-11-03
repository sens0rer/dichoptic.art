<script lang="ts">
	let { data } = $props();
	const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '–');
</script>

<svelte:head><title>Export · Colour tests</title></svelte:head>

<main>
	<div class="top"><a href="/synesthesia">← Tests</a> · <a href="/synesthesia/admin">Items</a></div>
	<h1>Export</h1>
	<ul class="files">
		<li><a href="/synesthesia/export/answers.csv" download>answers.csv</a> <span>every answer, with the text it covers, colour values and timecodes</span></li>
		<li><a href="/synesthesia/export/reverse.csv" download>reverse.csv</a> <span>the reverse test</span></li>
		<li><a href="/synesthesia/export/all.json" download>all.json</a> <span>everything, including sessions, devices, items and result views</span></li>
	</ul>

	<h2>Participants</h2>
	<p class="muted">One per browser. Answers from anyone other than her can be filtered out by this id.</p>
	<table>
		<thead><tr><th>Id</th><th>First seen</th><th>Answers</th><th>Reverse</th><th>Last answer</th><th>Devices</th></tr></thead>
		<tbody>
			{#each data.participants as p (p.id)}
				<tr>
					<td><a href="/synesthesia/admin/participant/{p.id}"><code>{p.id}</code></a></td>
					<td>{when(p.created_at)}</td>
					<td>{p.answers}</td>
					<td>{p.reverse}</td>
					<td>{when(p.last)}</td>
					<td class="devices">{p.devices ?? '–'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</main>

<style>
	main {
		max-width: 1000px;
		margin: 0 auto;
		padding: 16px 16px 48px;
	}
	.top {
		font-size: 0.9rem;
	}
	h1 {
		font-size: 1.4rem;
	}
	h2 {
		font-size: 1.05rem;
		margin-top: 1.6em;
	}
	.files {
		padding: 0;
		list-style: none;
		display: grid;
		gap: 8px;
	}
	.files span,
	.muted {
		color: var(--syn-muted);
		font-size: 0.85rem;
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
		vertical-align: top;
	}
	.devices {
		max-width: 360px;
		overflow-wrap: anywhere;
	}
</style>

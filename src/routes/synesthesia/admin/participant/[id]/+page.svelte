<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head><title>Participant · Admin</title></svelte:head>

<main>
	<div class="top"><a href="/synesthesia/export">← Participants</a> · <a href="/synesthesia/admin">Items</a></div>
	<h1>Participant <code>{data.id}</code></h1>
	<p class="muted">First answer {when(data.since)}. Each item opens with this participant's answers drawn in their colours.</p>

	{#if data.mergedInto}
		<p class="note">
			This browser is tied to <a href="/synesthesia/admin/participant/{data.mergedInto}"><code>{data.mergedInto}</code></a>: everything it
			recorded is there now, and it continues as that participant.
		</p>
	{/if}

	<h2>Devices</h2>
	<ul>
		{#each data.sessions as s (s.id)}
			<li><span>{s.device}</span> <span class="muted">visit {when(s.at)}</span></li>
		{:else}
			<li class="muted">No visits recorded.</li>
		{/each}
	</ul>
	{#if data.tied.length}
		<p class="muted">
			Also this participant: {#each data.tied as t, i (t.id)}{i ? ', ' : ''}<a href="/synesthesia/admin/participant/{t.id}"><code>{t.id}</code></a
				>{#if t.at}&nbsp;(tied {when(t.at)}){/if}{/each}.
		</p>
	{/if}

	{#if !data.mergedInto && data.others.length}
		<details class="merge">
			<summary>Tie to another participant (same person, other device)</summary>
			<form method="post" action="?/merge" use:enhance>
				<p class="muted">
					Everything this browser recorded moves to the participant you choose, keeping the device of every answer; this browser then
					continues as that participant. Nothing is deleted, and a record of what moved is kept here.
				</p>
				<select name="into" required>
					{#each data.others as o (o)}<option value={o}>{o}</option>{/each}
				</select>
				<button>Tie</button>
				{#if form?.message}<p class="error">{form.message}</p>{/if}
			</form>
		</details>
	{/if}

	{#each data.groups as g (g.name)}
		<h2>{g.name}</h2>
		<ul>
			{#each g.items as i (i.attemptId)}
				<li>
					<a href="/synesthesia/admin/item/{i.stimulusId}#a-{i.attemptId}">{i.preview}</a>
					<span class="muted">
						{i.retest ? 'retest · ' : ''}{i.answers} answer{i.answers === 1 ? '' : 's'} · {i.finished ? `finished ${when(i.finished)}` : 'unfinished'}
						· {i.devices.join(', ')}
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
					<span class="muted">{r.hex} · {r.device} · {when(r.at)}</span>
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
	.note {
		padding: 8px 12px;
		background: var(--syn-surface);
		border-radius: 8px;
	}
	.merge {
		margin-top: 1.2em;
	}
	.merge form {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.merge form p {
		width: 100%;
	}
	.error {
		color: #6b1010;
	}
	.swatch {
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 6px;
	}
</style>

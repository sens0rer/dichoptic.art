<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { CHECKLIST, checklistDone, saveChecklist } from '#lib/synesthesia/checklist';

	let { data, form } = $props();
	const empty = $derived(page.url.searchParams.get('empty'));

	// Screen settings that tint colours, checked once per visit; the answers are stored with
	// the session.
	let showChecklist = $state(false);
	let ticks = $state<Record<string, boolean>>({});
	onMount(() => (showChecklist = !checklistDone()));
	function doneChecklist() {
		saveChecklist(ticks);
		showChecklist = false;
	}
</script>

<main>
	<div class="head">
		<h1>Colour tests</h1>
		<a href="/synesthesia/results">Results</a>
	</div>

	{#if showChecklist}
		<section class="checklist">
			<h2>Before you start</h2>
			<p>Some phone and computer settings change the colours on screen. Tick what is true right now:</p>
			{#each CHECKLIST as item (item.id)}
				<label><input type="checkbox" bind:checked={ticks[item.id]} /> {item.label}</label>
			{/each}
			<button class="primary" onclick={doneChecklist}>Done</button>
		</section>
	{/if}

	{#if data.continueTo}
		<a class="btn primary continue" href="/synesthesia/a/{data.continueTo}">Continue where you left off</a>
	{/if}

	{#if form?.error || empty}
		<p class="notice">{form?.error ?? 'That was the last new item in this category.'}</p>
	{/if}

	<h2>Categories</h2>
	<ul class="cats">
		{#each data.categories as c (c.id)}
			<li>
				<div>
					<strong>{c.name}</strong>
					<p>{c.description}</p>
					<p class="counts">{c.status}</p>
				</div>
				<form method="post" action="?/start" use:enhance>
					<input type="hidden" name="category" value={c.id} />
					<button class="primary" disabled={!c.startable}>{c.id === 'reverse' ? 'Open' : 'Start'}</button>
				</form>
			</li>
		{/each}
	</ul>

	{#if data.unfinished.length}
		<h2>Unfinished</h2>
		<ul class="list">
			{#each data.unfinished as u (u.id)}
				<li>
					<a href="/synesthesia/a/{u.id}">{u.title ?? u.preview}</a>
					<span class="muted">{u.category}</span>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: 24px 16px 48px;
	}
	h1 {
		font-size: 1.6rem;
		margin: 0;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.8em;
	}
	.checklist {
		display: grid;
		gap: 10px;
		padding: 14px;
		margin-bottom: 1em;
		background: var(--syn-surface);
		border-radius: 10px;
	}
	.checklist h2 {
		margin: 0;
	}
	.checklist p {
		margin: 0;
		font-size: 0.9rem;
	}
	.checklist label {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		font-size: 0.95rem;
		color: var(--syn-text);
	}
	.checklist input {
		width: 22px;
		height: 22px;
		flex: none;
	}
	.checklist button {
		justify-self: start;
	}
	h2 {
		margin-top: 1.6em;
		font-size: 1.05rem;
	}
	.continue {
		display: flex;
		justify-content: center;
		padding: 0.8em;
		margin: 0.5em 0 1em;
	}
	.notice {
		padding: 8px 12px;
		background: var(--syn-surface);
		border-radius: 8px;
	}
	.cats,
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 10px;
	}
	.cats li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		background: var(--syn-surface);
		border-radius: 10px;
	}
	.cats p {
		margin: 2px 0 0;
		font-size: 0.9rem;
	}
	.cats button {
		white-space: nowrap;
	}
	.cats form {
		flex: none;
	}
	.counts,
	.muted {
		color: var(--syn-muted);
		font-size: 0.8rem;
	}
	.list li {
		min-width: 0;
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--syn-line);
	}
	.list a {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.list .muted {
		flex: none;
	}
</style>

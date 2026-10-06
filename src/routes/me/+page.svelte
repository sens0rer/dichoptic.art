<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '#lib/consent.svelte';
	import { thumbUrl } from '#lib/urls';

	let { data } = $props();
	let copied = $state(false);

	async function remove(type: 'images' | 'collections', id: string, what: string) {
		if (!confirm(`Delete this ${what}?`)) return;
		const res = await api(`/api/${type}/${id}`, { method: 'DELETE' });
		if (res.ok) await invalidateAll();
	}

	const link = $derived(data.owner ? `${page.url.origin}${data.recovery}` : '');
</script>

<svelte:head><title>My submissions · dichoptic.art</title></svelte:head>

<main>
	<h1>My submissions</h1>

	{#if !data.owner}
		<div class="empty">
			<p>Nothing here on this device.</p>
			<p class="small">
				Submissions are tied to a cookie, not an account. If you accepted cookies when you uploaded, they
				appear here; on another device open your recovery link.
			</p>
			<a class="btn" href="/upload">Upload</a>
		</div>
	{:else}
		<div class="panel">
			<strong>Recovery link</strong>
			<span class="muted small"> — open it on any device to manage these submissions there. Keep it private.</span>
			<div class="row" style="margin-top: 0.5em">
				<input readonly value={link} onfocus={(e) => e.currentTarget.select()} aria-label="Recovery link" style="flex: 1; min-width: 14em" />
				<button
					onclick={async () => {
						await navigator.clipboard.writeText(link);
						copied = true;
					}}>{copied ? 'Copied' : 'Copy'}</button
				>
			</div>
		</div>

		{#if data.collections.length === 0 && data.images.length === 0}
			<div class="empty">
				<p>You have not submitted anything yet.</p>
				<a class="btn primary" href="/upload">Upload a pair</a>
			</div>
		{/if}

		{#if data.collections.length}
			<h2>Collections</h2>
			<ul class="list">
				{#each data.collections as c (c.id)}
					<li class="panel item">
						{#if c.thumbPrefix}<img src={thumbUrl(c.thumbPrefix, 400)} alt="" />{/if}
						<div class="info">
							<a href="/collection/{c.id}"><strong>{c.title}</strong></a>
							<span class="muted small">{c.count} pairs</span>
							{#if c.status !== 'approved'}
								<span class="badge {c.status}">{c.status}</span>
								{#if c.status === 'rejected' && c.rejectReason}<span class="small">{c.rejectReason}</span>{/if}
							{/if}
						</div>
						<div class="row">
							<a class="btn" href="/collection/{c.id}/edit">Edit</a>
							<button class="danger" onclick={() => remove('collections', c.id, 'collection and everything in it')}>Delete</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		{#if data.images.length}
			<h2>Pairs</h2>
			<ul class="list">
				{#each data.images as i (i.id)}
					<li class="panel item">
						<img src={thumbUrl(i.thumbPrefix, 400)} alt="" />
						<div class="info">
							<a href="/image/{i.id}"><strong>{i.title}</strong></a>
							{#if i.status !== 'approved'}
								<span class="badge {i.status}">{i.status}</span>
								{#if i.status === 'rejected' && i.rejectReason}<span class="small">{i.rejectReason}</span>{/if}
							{/if}
							<span class="muted small">♥ {i.likeCount}</span>
						</div>
						<div class="row">
							<a class="btn" href="/image/{i.id}/edit">Edit</a>
							<button class="danger" onclick={() => remove('images', i.id, 'pair')}>Delete</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</main>

<style>
	.list {
		list-style: none;
		padding: 0;
		margin: 0 0 1.5em;
	}
	.item {
		display: flex;
		gap: 1em;
		align-items: center;
		flex-wrap: wrap;
	}
	.item img {
		width: 160px;
		height: 90px;
		object-fit: cover;
		border-radius: 4px;
		background: #000;
	}
	.info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.2em;
		min-width: 10em;
	}
</style>

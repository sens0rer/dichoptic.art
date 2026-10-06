<script lang="ts">
	import { goto } from '$app/navigation';
	import Credits from '#lib/components/Credits.svelte';
	import LikeButton from '#lib/components/LikeButton.svelte';
	import Meta from '#lib/components/Meta.svelte';
	import NavArrows from '#lib/components/NavArrows.svelte';
	import OgTags from '#lib/components/OgTags.svelte';
	import RecoveryNotice from '#lib/components/RecoveryNotice.svelte';
	import ShareButtons from '#lib/components/ShareButtons.svelte';
	import { creditText } from '#lib/credit';
	import { api } from '#lib/consent.svelte';
	import { thumbSrcset, thumbUrl } from '#lib/urls';

	let { data } = $props();
	const c = $derived(data.collection);

	async function remove() {
		if (!confirm('Delete this collection and every pair in it?')) return;
		const res = await api(`/api/collections/${c.id}`, { method: 'DELETE' });
		if (res.ok) await goto('/me', { refreshAll: true });
	}
</script>

{#if data.live && data.cover}
	<OgTags
		publicUrl={data.publicUrl}
		path="/collection/{c.id}"
		title={c.title}
		description={c.description ?? ([creditText(c.credit), c.submittedBy].filter(Boolean).join(' · ') || null)}
		thumbPrefix={data.cover.thumbPrefix}
	/>
{/if}

<svelte:head><title>{c.title} · dichoptic.art</title></svelte:head>

<main>
	<RecoveryNotice />
	<div class="row head">
		<a href={data.back}>← Back</a>
		<span class="spacer"></span>
		<NavArrows prev={data.prev} next={data.next} />
	</div>
	<h1>{c.title}</h1>
	{#if data.isPrivate}
		<p class="panel">
			<span class="badge">private</span>
			Only {data.isOwner ? 'you' : 'its owner'} and site admins can see this collection and its pairs.
		</p>
	{:else if !data.live}
		<p class="panel">
			<span class="badge {c.status}">{c.status}</span>
			{#if c.status === 'pending'}Only you can see this until it is approved.{/if}
			{#if c.status === 'rejected'}Rejected{c.rejectReason ? `: ${c.rejectReason}` : '.'}{/if}
		</p>
	{/if}

	<div class="row actions">
		{#if data.live}<LikeButton type="collection" id={c.id} count={c.likeCount} liked={data.liked} />{/if}
		{#if !data.isPrivate}<ShareButtons title={c.title} />{/if}
		{#if data.isOwner}
			<a class="btn" href="/upload?collection={c.id}">Add pairs</a>
			<a class="btn" href="/collection/{c.id}/edit">Edit</a>
			<button class="danger" onclick={remove}>Delete</button>
		{/if}
	</div>

	{#if c.description}<p class="desc">{c.description}</p>{/if}
	<Credits date={c.date} credit={c.credit} submittedBy={c.submittedBy} author={c.author} />
	<Meta fields={c} />
	{#if data.tags.length}
		<ul class="chips tags">
			{#each data.tags as t (t)}
				<li class="chip"><a href="/?tag={encodeURIComponent(t)}">#{t}</a></li>
			{/each}
		</ul>
	{/if}

	<ul class="grid">
		{#each data.images as i (i.id)}
			<li>
				<a href="/image/{i.id}" class="card">
					<img
						src={thumbUrl(i.thumbPrefix, 800)}
						srcset={thumbSrcset(i.thumbPrefix)}
						sizes="(min-width: 900px) 33vw, 100vw"
						alt={i.title ?? c.title}
						loading="lazy"
					/>
					<span class="meta small">
						<span>{i.title ?? ''}</span>
						{#if i.status !== 'approved'}<span class="badge {i.status}">{i.status}</span>{/if}
						<span class="muted">♥ {i.likeCount}</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
</main>

<style>
	.spacer {
		flex: 1;
	}
	.actions {
		margin-bottom: 1em;
	}
	.desc {
		white-space: pre-wrap;
		max-width: 70ch;
	}
	.tags {
		list-style: none;
		padding: 0;
	}
	.grid {
		list-style: none;
		margin: 1.5em 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
		gap: 1em;
	}
	.card {
		display: block;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.card:hover {
		border-color: #555;
		text-decoration: none;
	}
	/* Fixed tile shape so rows line up; whole pair always visible, letterboxed in the card colour. */
	img {
		display: block;
		width: 100%;
		aspect-ratio: 5 / 2;
		object-fit: contain;
		background: var(--surface);
	}
	.meta {
		display: flex;
		justify-content: space-between;
		gap: 0.5em;
		padding: 0.5em 0.8em;
	}
</style>

<script lang="ts">
	import { goto } from '$app/navigation';
	import Credits from '#lib/components/Credits.svelte';
	import LikeButton from '#lib/components/LikeButton.svelte';
	import Meta from '#lib/components/Meta.svelte';
	import OgTags from '#lib/components/OgTags.svelte';
	import PairViewer from '#lib/components/PairViewer.svelte';
	import RecoveryNotice from '#lib/components/RecoveryNotice.svelte';
	import ShareButtons from '#lib/components/ShareButtons.svelte';
	import { api } from '#lib/consent.svelte';

	let { data } = $props();
	const image = $derived(data.image);

	const fallbackDescription = $derived(
		image.description ?? ([image.creditName, image.submittedBy].filter(Boolean).join(' · ') || null)
	);

	async function remove() {
		if (!confirm('Delete this pair? It disappears from the site.')) return;
		const res = await api(`/api/images/${image.id}`, { method: 'DELETE' });
		if (res.ok) await goto(data.collection ? `/collection/${data.collection.id}` : '/me', { invalidateAll: true });
	}
</script>

{#if data.live}
	<OgTags
		publicUrl={data.publicUrl}
		path="/image/{image.id}"
		title={image.title}
		description={fallbackDescription}
		thumbPrefix={image.thumbPrefix}
	/>
{/if}

<svelte:head><title>{image.title} · dichoptic.art</title></svelte:head>

<main>
	<RecoveryNotice />

	<div class="row head">
		<a href={data.back}>← Back</a>
		<span class="spacer"></span>
		{#if data.prev}<a class="btn" href={data.prev} aria-label="Previous (left arrow)">←</a>{/if}
		{#if data.next}<a class="btn" href={data.next} aria-label="Next (right arrow)">→</a>{/if}
	</div>

	<h1>{image.title}</h1>
	{#if data.collection}
		<p class="muted">In collection <a href="/collection/{data.collection.id}">{data.collection.title}</a></p>
	{/if}
	{#if !data.live}
		<p class="panel">
			<span class="badge {image.status}">{image.status}</span>
			{#if image.status === 'pending'}Only you can see this until it is approved.{/if}
			{#if image.status === 'rejected'}Rejected{image.rejectReason ? `: ${image.rejectReason}` : '.'}{/if}
		</p>
	{/if}

	<PairViewer {image} prev={data.prev} next={data.next} />

	<div class="row actions">
		{#if data.live}
			<LikeButton type="image" id={image.id} count={image.likeCount} liked={data.liked} />
		{/if}
		<ShareButtons title={image.title} />
		{#if data.isOwner}
			<a class="btn" href="/image/{image.id}/edit">Edit</a>
			<button class="danger" onclick={remove}>Delete</button>
		{/if}
	</div>

	{#if image.description}<p class="desc">{image.description}</p>{/if}
	<Credits
		creditName={image.creditName}
		creditUrl={image.creditUrl}
		submittedBy={image.submittedBy}
		author={image.author}
	/>
	<Meta fields={data.eff} />
	{#if data.tags.length}
		<ul class="chips tags">
			{#each data.tags as t (t)}
				<li class="chip"><a href="/search?tag={encodeURIComponent(t)}">#{t}</a></li>
			{/each}
		</ul>
	{/if}
	<p class="muted small keys">
		Keys: ← → previous/next · F fullscreen{image.sourceMode === 'two_files' ? ' · O outline · S swap sides' : ''}
	</p>
</main>

<style>
	.head {
		margin-bottom: 0.5em;
	}
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
</style>

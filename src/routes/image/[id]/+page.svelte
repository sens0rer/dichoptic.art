<script lang="ts">
	import { goto } from '$app/navigation';
	import Credits from '#lib/components/Credits.svelte';
	import LikeButton from '#lib/components/LikeButton.svelte';
	import NavArrows from '#lib/components/NavArrows.svelte';
	import Meta from '#lib/components/Meta.svelte';
	import OgTags from '#lib/components/OgTags.svelte';
	import PairViewer from '#lib/components/PairViewer.svelte';
	import RecoveryNotice from '#lib/components/RecoveryNotice.svelte';
	import ShareButtons from '#lib/components/ShareButtons.svelte';
	import { creditText } from '#lib/credit';
	import { api } from '#lib/consent.svelte';

	let { data } = $props();
	const image = $derived(data.image);

	const fallbackDescription = $derived(
		image.description ?? ([creditText(image.credit), image.submittedBy].filter(Boolean).join(' · ') || null)
	);

	async function remove() {
		if (!confirm('Delete this pair? It disappears from the site.')) return;
		const res = await api(`/api/images/${image.id}`, { method: 'DELETE' });
		if (res.ok) await goto(data.collection ? `/collection/${data.collection.id}` : '/me', { refreshAll: true });
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
		<NavArrows prev={data.prev} next={data.next} />
	</div>

	<div class="titlebar">
		<div class="titles">
			<h1>{image.title}</h1>
			{#if data.collection}
				<p class="muted">In collection <a href="/collection/{data.collection.id}">{data.collection.title}</a></p>
			{/if}
		</div>
		<div class="actions">
			{#if data.live}
				<LikeButton type="image" id={image.id} count={image.likeCount} liked={data.liked} />
			{/if}
			{#if !data.isPrivate}<ShareButtons title={image.title} />{/if}
			{#if data.isOwner}
				<a class="btn" href="/image/{image.id}/edit">Edit</a>
				<button class="danger" onclick={remove}>Delete</button>
			{/if}
		</div>
	</div>
	{#if data.isPrivate}
		<p class="panel">
			<span class="badge">private</span>
			Only {data.isOwner ? 'you' : 'its owner'} and site admins can see this.
		</p>
	{:else if !data.live}
		<p class="panel">
			<span class="badge {image.status}">{image.status}</span>
			{#if image.status === 'pending'}Only you can see this until it is approved.{/if}
			{#if image.status === 'rejected'}Rejected{image.rejectReason ? `: ${image.rejectReason}` : '.'}{/if}
		</p>
	{/if}

	{#key image.id}
		<PairViewer {image} />
	{/key}

	<section class="info">
		<div>
			{#if image.description}<p class="desc">{image.description}</p>{/if}
			<Credits
				date={data.eff.date}
				credit={image.credit}
				submittedBy={image.submittedBy}
				author={image.author}
			/>
		</div>
		<div>
			<Meta fields={data.eff} />
			{#if data.tags.length}
				<ul class="chips tags">
					{#each data.tags as t (t)}
						<li class="chip"><a href="/?tag={encodeURIComponent(t)}">#{t}</a></li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>
</main>

<style>
	.head {
		margin-bottom: 0.5em;
	}
	.spacer {
		flex: 1;
	}
	.titlebar {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 0.6em 1em;
		margin-bottom: 0.8em;
	}
	.titlebar h1,
	.titlebar p {
		margin: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5em;
	}
	.info {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: 1.5em;
		margin-top: 1.5em;
		padding-top: 1.2em;
		border-top: 1px solid var(--border);
	}
	@media (max-width: 760px) {
		.info {
			grid-template-columns: 1fr;
		}
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

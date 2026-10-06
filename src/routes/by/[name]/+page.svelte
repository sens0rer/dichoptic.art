<script lang="ts">
	import FeedView from '#lib/components/FeedView.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.name} · dichoptic.art</title></svelte:head>

<main>
	<h1>Submitted by {data.name}</h1>
	<p class="muted small">Grouped by the name typed at submission; names are not verified accounts.</p>
	<FeedView {data} showQuery={false} />
</main>

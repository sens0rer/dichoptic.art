<script lang="ts">
	import FeedView from '#lib/components/FeedView.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Search · dichoptic.art</title></svelte:head>

<main>
	<h1>Search</h1>
	<FeedView {data} />
</main>

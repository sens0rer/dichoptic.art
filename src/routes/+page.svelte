<script lang="ts">
	import FeedView from '#lib/components/FeedView.svelte';

	let { data } = $props();
</script>

<svelte:head><title>dichoptic.art</title></svelte:head>

<main>
	<FeedView {data} />
</main>

<script lang="ts">
	import FeedView from '#lib/components/FeedView.svelte';

	let { data } = $props();

	const description = 'Browse and share dichoptic image pairs: art and photography made for dichoptic color viewing.';
</script>

<svelte:head>
	<title>dichoptic.art</title>
	<meta name="description" content={description} />
	<meta property="og:title" content="dichoptic.art" />
	<meta property="og:description" content={description} />
	<meta property="og:image" content="{data.publicUrl}/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:url" content={data.publicUrl} />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main>
	<FeedView {data} />
</main>

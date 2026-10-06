<script lang="ts">
	import { absoluteUrl, thumbUrl } from '#lib/urls';

	let {
		publicUrl,
		path,
		title,
		description,
		thumbPrefix
	}: {
		publicUrl: string;
		path: string;
		title: string;
		description: string | null;
		thumbPrefix: string;
	} = $props();
</script>

<svelte:head>
	<meta property="og:title" content={title} />
	{#if description}
		<meta property="og:description" content={description} />
		<meta name="description" content={description} />
	{/if}
	<meta property="og:image" content={absoluteUrl(thumbUrl(thumbPrefix, 1600), publicUrl)} />
	<meta property="og:url" content={publicUrl + path} />
	<meta property="og:type" content="article" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

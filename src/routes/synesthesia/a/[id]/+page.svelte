<script lang="ts">
	import Item from '#lib/synesthesia/Item.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.stimulus.category} · Colour tests</title></svelte:head>

{#key data.attempt.id}
	<Item {data} />
{/key}

<script lang="ts">
	import { parseLinks } from '#lib/links';

	let { text }: { text: string } = $props();
</script>

{#each parseLinks(text) as part, i (i)}{#if part.href}<a
			href={part.href}
			rel="noopener noreferrer nofollow"
			target="_blank">{part.text}</a
		>{:else}{part.text}{/if}{/each}

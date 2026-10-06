<script lang="ts">
	let { title }: { title: string } = $props();

	let copied = $state(false);
	let canShare = $state(false);
	$effect(() => {
		canShare = typeof navigator !== 'undefined' && 'share' in navigator;
	});

	async function copy() {
		try {
			await navigator.clipboard.writeText(location.href.replace(/[?&]new=1/, ''));
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			prompt('Copy this link', location.href);
		}
	}
</script>

<button type="button" onclick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
{#if canShare}
	<button type="button" onclick={() => navigator.share({ title, url: location.href })}>Share</button>
{/if}

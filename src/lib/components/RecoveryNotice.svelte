<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	let key = $state<string | null>(null);
	let copied = $state(false);

	onMount(() => {
		if (!page.url.searchParams.has('new')) return;
		try {
			key = sessionStorage.getItem('recovery');
		} catch {
			key = null;
		}
	});

	const link = $derived(key ? `${location.origin}/claim/${key}` : '');
</script>

{#if key}
	<div class="panel">
		<strong>Save this link.</strong>
		<span class="muted">
			It is the only way to edit or delete your submissions from another device or if you clear your
			cookies. Anyone with it can edit and delete them.
		</span>
		<div class="row" style="margin-top: 0.6em">
			<input readonly value={link} onfocus={(e) => e.currentTarget.select()} aria-label="Recovery link" style="flex: 1; min-width: 14em" />
			<button
				type="button"
				onclick={async () => {
					await navigator.clipboard.writeText(link);
					copied = true;
				}}>{copied ? 'Copied' : 'Copy'}</button
			>
		</div>
	</div>
{/if}

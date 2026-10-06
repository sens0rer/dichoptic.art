<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, askConsent, consent } from '#lib/consent.svelte';

	let { data } = $props();
	let message = $state('');
	let working = false;

	async function adopt() {
		if (working) return;
		working = true;
		const res = await api('/api/claim', { json: { key: data.key } });
		working = false;
		if (res.ok) await goto('/me', { refreshAll: true });
		else message = res.data.error ?? 'Could not use this link';
	}

	// Waits for the visitor's cookie choice before touching anything.
	$effect(() => {
		if (consent.ready && consent.choice === 'accepted') void adopt();
	});
</script>

<svelte:head><title>Recovery link · dichoptic.art</title></svelte:head>

<main class="narrow">
	<h1>Recovery link</h1>
	{#if consent.choice === 'denied'}
		<p>
			Using this link needs a cookie to remember it on this device. Cookies are currently denied, so
			nothing was changed.
		</p>
		<button class="primary" onclick={askConsent}>Review cookie choice</button>
	{:else}
		<p class="muted">Accept the cookie notice to continue — your submissions will be linked to this device.</p>
	{/if}
	{#if message}<p class="error">{message}</p>{/if}
</main>

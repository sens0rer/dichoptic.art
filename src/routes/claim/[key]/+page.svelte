<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, askConsent, consent } from '#lib/consent.svelte';

	let { data } = $props();
	let message = $state('');
	let working = $state(false);

	async function adopt(merge = false) {
		if (working) return;
		working = true;
		message = '';
		const res = await api('/api/claim', { json: { key: data.key, merge } });
		working = false;
		if (res.ok) await goto('/me', { refreshAll: true });
		else message = res.data.error ?? 'Could not use this link';
	}

	// With nothing on this browser to combine, the link is used as soon as cookies are accepted.
	$effect(() => {
		if (consent.ready && consent.choice === 'accepted' && !data.held) void adopt();
	});

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	const heldText = $derived(
		data.held
			? [
					data.held.images ? plural(data.held.images, 'image', 'images') : '',
					data.held.collections ? plural(data.held.collections, 'collection', 'collections') : '',
					data.held.likes ? plural(data.held.likes, 'like', 'likes') : ''
				]
					.filter(Boolean)
					.join(', ')
			: ''
	);
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
	{:else if data.held}
		<div class="panel">
			<p>
				This browser already has its own submissions ({heldText}). Continuing combines them with the
				ones from this link, so you manage everything from one place.
			</p>
			<div class="row">
				<button class="primary" disabled={working || consent.choice !== 'accepted'} onclick={() => adopt(true)}>
					{working ? 'Combining…' : 'Combine and continue'}
				</button>
				<a class="btn" href="/me">Cancel</a>
			</div>
			{#if consent.choice !== 'accepted'}
				<p class="muted small" style="margin-top: 0.8em">Accept the cookie notice to continue.</p>
			{/if}
		</div>
	{:else}
		<p class="muted">Accept the cookie notice to continue — your submissions will be linked to this device.</p>
	{/if}
	{#if message}<p class="error">{message}</p>{/if}
</main>

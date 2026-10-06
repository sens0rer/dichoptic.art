<script lang="ts">
	import { untrack } from 'svelte';
	import { api, askConsent, consent } from '#lib/consent.svelte';

	let {
		type,
		id,
		count,
		liked
	}: { type: 'image' | 'collection'; id: string; count: number; liked: boolean } = $props();

	let n = $state(untrack(() => count));
	let on = $state(untrack(() => liked));
	let busy = $state(false);

	async function toggle() {
		if (consent.choice !== 'accepted') return askConsent();
		busy = true;
		const res = await api<{ liked: boolean; count: number }>('/api/like', { json: { type, id } });
		busy = false;
		if (res.ok) {
			on = res.data.liked;
			n = res.data.count;
		}
	}
</script>

<button
	type="button"
	class:active={on}
	onclick={toggle}
	disabled={busy}
	aria-pressed={on}
	title={consent.choice === 'accepted' ? 'Like' : 'Likes need cookies'}
>
	{on ? '♥' : '♡'} {n}
</button>

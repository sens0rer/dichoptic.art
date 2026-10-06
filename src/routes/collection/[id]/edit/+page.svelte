<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import MetaFields from '#lib/components/MetaFields.svelte';
	import { api } from '#lib/consent.svelte';
	import type { Meta } from '#lib/formTypes';
	import { thumbUrl } from '#lib/urls';

	let { data } = $props();

	const { coverImageId, id: _id, ...initial } = untrack(() => data.collection);
	let meta = $state<Meta>({ ...initial });
	let cover = $state<string>(coverImageId ?? untrack(() => data.images[0]?.id) ?? '');
	let errors = $state<Record<string, string>>({});
	let message = $state('');
	let saving = $state(false);

	async function save() {
		saving = true;
		message = '';
		const res = await api(`/api/collections/${data.collection.id}`, {
			method: 'PATCH',
			json: { meta, cover }
		});
		saving = false;
		if (!res.ok) {
			errors = res.data.errors ?? {};
			message = res.data.error ?? 'Could not save';
			return;
		}
		await goto(`/collection/${data.collection.id}`, { refreshAll: true });
	}
</script>

<svelte:head><title>Edit collection · dichoptic.art</title></svelte:head>

<main class="narrow">
	<a href="/collection/{data.collection.id}">← Back</a>
	<h1>Edit collection</h1>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			void save();
		}}
	>
		<MetaFields bind:values={meta} {errors} presets={data.presets} subject="collection" />

		<fieldset class="cover">
			<legend>Cover</legend>
			<div class="covers">
				{#each data.images as i (i.id)}
					<label class="pick" class:on={cover === i.id}>
						<input type="radio" name="cover" value={i.id} bind:group={cover} class="sr-only" />
						<img src={thumbUrl(i.thumbPrefix, 400)} alt={i.title ?? 'Pair'} />
					</label>
				{/each}
			</div>
		</fieldset>

		{#if message}<p class="error">{message}</p>{/if}
		<button class="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
	</form>
</main>

<style>
	.cover {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		margin: 0 0 1em;
	}
	legend {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.covers {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.6em;
	}
	.pick {
		margin: 0;
		border: 2px solid transparent;
		border-radius: 6px;
		overflow: hidden;
		cursor: pointer;
	}
	.pick.on {
		border-color: var(--accent);
	}
	.pick img {
		display: block;
		width: 100%;
	}
</style>

<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import MetaFields from '#lib/components/MetaFields.svelte';
	import PairPicker from '#lib/components/PairPicker.svelte';
	import { api } from '#lib/consent.svelte';
	import type { Meta, PairRef } from '#lib/formTypes';
	import { thumbUrl } from '#lib/urls';

	let { data } = $props();

	const { sourceMode: _mode, thumbPrefix: _thumb, id: _id, ...initial } = untrack(() => data.image);
	let meta = $state<Meta>({ ...initial });
	let replace = $state(false);
	let pair = $state<PairRef | null>(null);
	let busy = $state(false);
	let errors = $state<Record<string, string>>({});
	let message = $state('');
	let saving = $state(false);
	let duplicate = $state<{ id: string; title: string | null } | null>(null);

	async function save(confirm = false) {
		saving = true;
		message = '';
		duplicate = null;
		const res = await api<{ duplicate?: typeof duplicate }>(`/api/images/${data.image.id}`, {
			method: 'PATCH',
			json: { meta, pair: replace ? pair : undefined, confirm }
		});
		saving = false;
		if (res.data.duplicate) {
			duplicate = res.data.duplicate;
			return;
		}
		if (!res.ok) {
			errors = res.data.errors ?? {};
			message = res.data.error ?? 'Could not save';
			return;
		}
		await goto(`/image/${data.image.id}`, { refreshAll: true });
	}
</script>

<svelte:head><title>Edit · dichoptic.art</title></svelte:head>

<main class="narrow">
	<a href="/image/{data.image.id}">← Back</a>
	<h1>Edit image</h1>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			void save();
		}}
	>
		<div class="panel">
			<img class="cur" src={thumbUrl(data.image.thumbPrefix, 800)} alt="Current image" />
			<label class="inline">
				<input type="checkbox" bind:checked={replace} /> Replace the files
			</label>
			{#if replace}<PairPicker bind:pair bind:busy />{/if}
		</div>

		<MetaFields
			bind:values={meta}
			{errors}
			presets={data.presets}
			titleRequired={!data.master}
			inherit={data.master ? 'Inherit from collection' : null}
			inheritedMedium={data.master?.medium ?? null}
			showPrivate={!data.master}
		/>

		{#if duplicate}
			<div class="panel">
				<p>
					This might be a duplicate of: <a href="/image/{duplicate.id}" target="_blank">{duplicate.title ?? 'an existing image'}</a>
				</p>
				<div class="row">
					<button type="button" class="primary" onclick={() => save(true)}>Save anyway</button>
					<button type="button" onclick={() => (duplicate = null)}>Cancel</button>
				</div>
			</div>
		{/if}
		{#if message}<p class="error">{message}</p>{/if}
		<button class="primary" disabled={saving || busy || (replace && !pair)}>
			{saving ? 'Saving…' : 'Save'}
		</button>
	</form>
</main>

<style>
	.cur {
		width: 100%;
		max-height: 260px;
		object-fit: contain;
		background: #000;
		border-radius: 4px;
		margin-bottom: 0.6em;
	}
</style>

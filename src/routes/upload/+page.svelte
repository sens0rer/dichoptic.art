<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import MetaFields from '#lib/components/MetaFields.svelte';
	import PairPicker from '#lib/components/PairPicker.svelte';
	import { api } from '#lib/consent.svelte';
	import { emptyMeta, type PairRef } from '#lib/formTypes';

	let { data } = $props();

	type Target = 'image' | 'collection' | 'add';
	interface Row {
		key: number;
		title: string;
		pair: PairRef | null;
		busy: boolean;
	}

	let target = $state<Target>(untrack(() => (data.into ? 'add' : 'image')));
	let addTo = $state(untrack(() => data.into ?? data.myCollections[0]?.id ?? ''));
	let meta = $state(emptyMeta());
	let single = $state<{ pair: PairRef | null; busy: boolean }>({ pair: null, busy: false });
	let seq = 0;
	const newRow = (): Row => ({ key: seq++, title: '', pair: null, busy: false });
	let rows = $state<Row[]>([newRow()]);
	let cover = $state(0);

	let errors = $state<Record<string, string>>({});
	let message = $state('');
	let submitting = $state(false);
	let duplicate = $state<{ id: string; title: string | null } | null>(null);
	let duplicates = $state<{ index: number; id: string; title: string | null }[]>([]);

	const busy = $derived(target === 'image' ? single.busy : rows.some((r) => r.busy));
	const ready = $derived(
		target === 'image' ? !!single.pair : rows.length > 0 && rows.every((r) => r.pair)
	);

	function pickTarget(t: Target) {
		target = t;
		errors = {};
		message = '';
		duplicate = null;
		duplicates = [];
	}

	async function submit(confirm = false) {
		submitting = true;
		message = '';
		errors = {};
		duplicate = null;
		duplicates = [];

		let res;
		if (target === 'image') {
			res = await api<{ id: string; recovery: string; duplicate?: typeof duplicate }>('/api/images', {
				json: { meta, pair: single.pair, confirm }
			});
		} else if (target === 'collection') {
			res = await api('/api/collections', {
				json: {
					collection: meta,
					items: rows.map((r) => ({ title: r.title, pair: r.pair })),
					cover,
					confirm
				}
			});
		} else {
			res = await api(`/api/collections/${addTo}/images`, {
				json: { items: rows.map((r) => ({ title: r.title, pair: r.pair })), confirm }
			});
		}
		submitting = false;

		const d = res.data as {
			id?: string;
			recovery?: string;
			duplicate?: typeof duplicate;
			duplicates?: typeof duplicates;
		};
		if (d.duplicate) {
			duplicate = d.duplicate;
			return;
		}
		if (d.duplicates) {
			duplicates = d.duplicates;
			return;
		}
		if (!res.ok) {
			errors = res.data.errors ?? {};
			message = res.data.error ?? 'Something went wrong';
			return;
		}
		try {
			sessionStorage.setItem('recovery', d.recovery!);
		} catch {
			// the link is still shown on /me when the cookie was accepted
		}
		await goto(`/${target === 'image' ? 'image' : 'collection'}/${d.id}?new=1`);
	}
</script>

<svelte:head><title>Upload · dichoptic.art</title></svelte:head>

<main class="narrow">
	<h1>Upload</h1>

	{#if data.paused}
		<p class="panel">Submissions are paused for now. Browsing, search and likes still work.</p>
	{/if}

	<div class="row" style="margin-bottom: 1em" role="radiogroup" aria-label="What to upload">
		<button class:active={target === 'image'} onclick={() => pickTarget('image')}>Single pair</button>
		<button class:active={target === 'collection'} onclick={() => pickTarget('collection')}>
			New collection
		</button>
		{#if data.myCollections.length}
			<button class:active={target === 'add'} onclick={() => pickTarget('add')}>
				Add to my collection
			</button>
		{/if}
	</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			void submit();
		}}
	>
		{#if target === 'image'}
			<PairPicker bind:pair={single.pair} bind:busy={single.busy} />
			<MetaFields bind:values={meta} {errors} presets={data.presets} />
		{:else}
			{#if target === 'collection'}
				<div class="panel">
					<h2>Collection</h2>
					<p class="muted small">
						Settings here are defaults for every pair inside. A pair can override them later by editing it.
					</p>
					<MetaFields bind:values={meta} {errors} presets={data.presets} />
				</div>
			{:else}
				<div class="field">
					<label for="add-to">Collection</label>
					<select id="add-to" bind:value={addTo}>
						{#each data.myCollections as c (c.id)}<option value={c.id}>{c.title}</option>{/each}
					</select>
				</div>
			{/if}

			<h2>Pairs</h2>
			{#each rows as row, i (row.key)}
				<div class="panel">
					<div class="row" style="justify-content: space-between">
						<h3>Pair {i + 1}</h3>
						{#if rows.length > 1}
							<button
								type="button"
								class="link small"
								onclick={() => {
									rows = rows.filter((r) => r !== row);
									if (cover >= rows.length) cover = 0;
								}}>Remove pair</button
							>
						{/if}
					</div>
					<div class="field">
						<label for="t-{row.key}">Title (optional)</label>
						<input id="t-{row.key}" bind:value={row.title} maxlength="200" />
					</div>
					<PairPicker bind:pair={row.pair} bind:busy={row.busy} />
					{#if target === 'collection' && rows.length > 1}
						<label class="inline small">
							<input type="radio" name="cover" checked={cover === i} onchange={() => (cover = i)} />
							Use as the collection cover
						</label>
					{/if}
					{#if duplicates.find((d) => d.index === i)}
						{@const d = duplicates.find((x) => x.index === i)!}
						<p class="warn small">Might be a duplicate of <a href="/image/{d.id}" target="_blank">{d.title ?? 'an existing pair'}</a>.</p>
					{/if}
				</div>
			{/each}
			<button type="button" onclick={() => (rows = [...rows, newRow()])}>+ Add another pair</button>
			<div style="height: 1em"></div>
		{/if}

		{#if duplicate}
			<div class="panel">
				<p>
					This might be a duplicate of:
					<a href="/image/{duplicate.id}" target="_blank">{duplicate.title ?? 'an existing pair'}</a>
				</p>
				<div class="row">
					<button type="button" class="primary" onclick={() => submit(true)}>Submit anyway</button>
					<button type="button" onclick={() => (duplicate = null)}>Cancel</button>
				</div>
			</div>
		{/if}
		{#if duplicates.length}
			<div class="panel">
				<p>Some pairs might be duplicates (marked above). Review them, or continue.</p>
				<div class="row">
					<button type="button" class="primary" onclick={() => submit(true)}>Submit anyway</button>
					<button type="button" onclick={() => (duplicates = [])}>Cancel</button>
				</div>
			</div>
		{/if}

		{#if message}<p class="error">{message}</p>{/if}
		<button class="primary" type="submit" disabled={!ready || busy || submitting || data.paused}>
			{submitting ? 'Submitting…' : busy ? 'Uploading…' : 'Submit'}
		</button>
	</form>
</main>

<style>
	.warn {
		color: #fdd663;
	}
</style>

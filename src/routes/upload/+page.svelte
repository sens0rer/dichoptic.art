<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import MetaFields from '#lib/components/MetaFields.svelte';
	import PairPicker from '#lib/components/PairPicker.svelte';
	import { api, consent, setConsent } from '#lib/consent.svelte';
	import { emptyMeta, type Meta, type PairRef } from '#lib/formTypes';

	let { data } = $props();

	type Target = 'image' | 'collection' | 'add';
	interface Row {
		key: number;
		meta: Meta;
		details: boolean;
		pair: PairRef | null;
		busy: boolean;
	}

	let target = $state<Target>(untrack(() => (data.into ? 'add' : 'image')));
	let addTo = $state(untrack(() => data.into ?? data.myCollections[0]?.id ?? ''));
	let meta = $state(emptyMeta());
	let single = $state<{ pair: PairRef | null; busy: boolean }>({ pair: null, busy: false });
	let seq = 0;
	const newRow = (): Row => ({ key: seq++, meta: emptyMeta(''), details: false, pair: null, busy: false });
	let rows = $state<Row[]>([newRow()]);
	let cover = $state(0); // key of the row used as the collection cover

	let errors = $state<Record<string, string>>({});
	let message = $state('');
	let submitting = $state(false);
	// Shown once per submit when cookies are not accepted: without them nothing can be edited later.
	let askCookies = $state(false);
	let duplicate = $state<{ id: string; title: string | null } | null>(null);
	let duplicates = $state<{ index: number; id: string; title: string | null }[]>([]);

	const inheritedMedium = $derived(
		target === 'collection' ? meta.medium : (data.myCollections.find((c) => c.id === addTo)?.medium ?? null)
	);
	// Server errors for row i arrive keyed "items.<i>.<field>".
	const fieldErrors = (i: number) =>
		Object.fromEntries(
			Object.entries(errors)
				.filter(([k]) => k.startsWith(`items.${i}.`))
				.map(([k, v]) => [k.split('.').pop()!, v])
		);

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
					items: rows.map((r) => ({ meta: r.meta, pair: r.pair })),
					cover: Math.max(0, rows.findIndex((r) => r.key === cover)),
					confirm
				}
			});
		} else {
			res = await api(`/api/collections/${addTo}/images`, {
				json: { items: rows.map((r) => ({ meta: r.meta, pair: r.pair })), confirm }
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
		<button class:active={target === 'image'} onclick={() => pickTarget('image')}>Single image</button>
		<button class:active={target === 'collection'} onclick={() => pickTarget('collection')}>
			Collection of images
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
			if (consent.choice !== 'accepted') askCookies = true;
			else void submit();
		}}
	>
		{#if target === 'image'}
			<PairPicker bind:pair={single.pair} bind:busy={single.busy} />
			<MetaFields bind:values={meta} {errors} presets={data.presets} showPrivate />
		{:else}
			{#if target === 'collection'}
				<div class="panel">
					<h2>Collection</h2>
					<p class="muted small">
						These settings apply to every image in the collection. Any image can have its own settings instead.
					</p>
					<MetaFields bind:values={meta} {errors} presets={data.presets} subject="collection" showPrivate />
				</div>
			{:else}
				<div class="field">
					<label for="add-to">Collection</label>
					<select id="add-to" bind:value={addTo}>
						{#each data.myCollections as c (c.id)}<option value={c.id}>{c.title}</option>{/each}
					</select>
				</div>
			{/if}

			<h2>Images</h2>
			{#each rows as row, i (row.key)}
				<div class="panel">
					<div class="row" style="justify-content: space-between">
						<h3>Image {i + 1}</h3>
						{#if rows.length > 1}
							<button
								type="button"
								class="link small"
								onclick={() => {
									rows = rows.filter((r) => r !== row);
									if (cover === row.key) cover = rows[0].key;
								}}>Remove image</button
							>
						{/if}
					</div>
					<div class="field">
						<label for="t-{row.key}">Title</label>
						<input id="t-{row.key}" bind:value={row.meta.title} maxlength="200" />
					</div>
					<PairPicker bind:pair={row.pair} bind:busy={row.busy} />
					<button type="button" class="link small" onclick={() => (row.details = !row.details)}>
						{row.details ? 'Hide details for this image' : 'Set details for this image'}
					</button>
					{#if row.details}
						<div class="details">
							<p class="muted small">Anything left blank uses the collection's value.</p>
							<MetaFields
								bind:values={row.meta}
								errors={fieldErrors(i)}
								presets={data.presets}
								showTitle={false}
								inherit="Same as collection"
								inheritedMedium={inheritedMedium}
							/>
						</div>
					{/if}
					{#if target === 'collection' && rows.length > 1}
						<label class="inline small">
							<input type="radio" name="cover" checked={cover === row.key} onchange={() => (cover = row.key)} />
							Use as the collection cover
						</label>
					{/if}
					{#if duplicates.find((d) => d.index === i)}
						{@const d = duplicates.find((x) => x.index === i)!}
						<p class="warn small">Might be a duplicate of <a href="/image/{d.id}" target="_blank">{d.title ?? 'an existing image'}</a>.</p>
					{/if}
				</div>
			{/each}
			<button type="button" onclick={() => (rows = [...rows, newRow()])}>+ Add another image</button>
			<div style="height: 1em"></div>
		{/if}

		{#if duplicate}
			<div class="panel">
				<p>
					This might be a duplicate of:
					<a href="/image/{duplicate.id}" target="_blank">{duplicate.title ?? 'an existing image'}</a>
				</p>
				<div class="row">
					<button type="button" class="primary" onclick={() => submit(true)}>Submit anyway</button>
					<button type="button" onclick={() => (duplicate = null)}>Cancel</button>
				</div>
			</div>
		{/if}
		{#if duplicates.length}
			<div class="panel">
				<p>Some images might be duplicates (marked above). Review them, or continue.</p>
				<div class="row">
					<button type="button" class="primary" onclick={() => submit(true)}>Submit anyway</button>
					<button type="button" onclick={() => (duplicates = [])}>Cancel</button>
				</div>
			</div>
		{/if}

		{#if askCookies}
			<div class="panel">
				<h3>Before you upload</h3>
				<p>
					Without cookies you won't be able to edit or delete this submission later. You'll get a
					recovery link after uploading; keep it somewhere safe, it is the only way back to your
					submissions.
				</p>
				<div class="row">
					<button
						type="button"
						class="primary"
						onclick={() => {
							setConsent('accepted');
							askCookies = false;
							void submit();
						}}>Accept cookies and upload</button
					>
					<button
						type="button"
						onclick={() => {
							setConsent('denied');
							askCookies = false;
							void submit();
						}}>Upload without cookies</button
					>
					<button type="button" onclick={() => (askCookies = false)}>Cancel</button>
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
	.details {
		margin-top: 0.8em;
	}
	.warn {
		color: #fdd663;
	}
</style>

<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import TagInput from './TagInput.svelte';
	import { toParams, type Filters, type Sort } from '#lib/query';
	import { FILTER_CATEGORIES, LABELS } from '#lib/vocab';

	let {
		filters,
		sort,
		presets,
		showQuery = true
	}: {
		filters: Filters;
		sort: Sort;
		presets: { code: string; name: string }[];
		showQuery?: boolean;
	} = $props();

	// Form state is seeded once from the URL; the page re-mounts this component (via {#key}) on navigation.
	const initial = untrack(() => filters);
	let q = $state(initial.q);
	let values = $state<Record<string, string>>({
		dimension: initial.dimension,
		medium: initial.medium,
		alteration: initial.alteration,
		chromacy: initial.chromacy,
		chromacyType: initial.chromacyType
	});
	let tags = $state([...initial.tags]);
	let open = $state(
		!!(
			initial.dimension ||
			initial.medium ||
			initial.alteration ||
			initial.chromacy ||
			initial.chromacyType ||
			initial.tags.length
		)
	);

	function search(next: Sort = sort) {
		const params = toParams(
			{
				...filters,
				q: q.trim(),
				dimension: values.dimension,
				medium: values.medium,
				alteration: values.alteration,
				chromacy: values.chromacy,
				chromacyType: values.chromacyType.trim(),
				tags
			},
			next
		);
		const qs = params.toString();
		goto(`${page.url.pathname}${qs ? `?${qs}` : ''}`);
	}

	const sortHref = (s: Sort) => {
		const p = toParams(filters, s);
		const qs = p.toString();
		return `${page.url.pathname}${qs ? `?${qs}` : ''}`;
	};
</script>

<form
	class="bar"
	onsubmit={(e) => {
		e.preventDefault();
		search();
	}}
>
	<div class="row top">
		<div class="tabs" role="tablist">
			<a href={sortHref('new')} class:on={sort === 'new'} role="tab" aria-selected={sort === 'new'}>Newest</a>
			<a href={sortHref('liked')} class:on={sort === 'liked'} role="tab" aria-selected={sort === 'liked'}>Most liked</a>
		</div>
		{#if showQuery}
			<input class="q" type="search" placeholder="Search titles, credits, tags…" bind:value={q} aria-label="Search" />
		{/if}
		<button type="button" onclick={() => (open = !open)} aria-expanded={open}>Filters</button>
		<button class="primary" type="submit">Apply</button>
	</div>
	{#if open}
		<div class="grid2 panel">
			{#each FILTER_CATEGORIES as cat (cat.key)}
				<div>
					<label for="f-{cat.key}">{cat.label}</label>
					<select id="f-{cat.key}" bind:value={values[cat.key]}>
						<option value="">Any</option>
						{#each cat.values as v (v)}<option value={v}>{LABELS[v]}</option>{/each}
					</select>
				</div>
			{/each}
			<div>
				<label for="f-ctype">Dichoptic color type</label>
				<input id="f-ctype" list="f-ctype-list" bind:value={values.chromacyType} placeholder="e.g. TRT" />
				<datalist id="f-ctype-list">
					{#each presets as p (p.code)}<option value={p.code}>{p.name}</option>{/each}
				</datalist>
			</div>
			<div style="grid-column: 1 / -1">
				<label for="f-tags">Tags (all must match)</label>
				<TagInput id="f-tags" bind:tags />
			</div>
		</div>
	{/if}
</form>

<style>
	.bar {
		margin-bottom: 1.2em;
	}
	.top {
		gap: 0.6em;
	}
	.q {
		flex: 1;
		min-width: 12em;
	}
	.tabs {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.tabs a {
		padding: 0.45em 0.9em;
		color: var(--muted);
	}
	.tabs a.on {
		background: var(--surface-2);
		color: var(--text);
	}
	.tabs a:hover {
		text-decoration: none;
		color: var(--text);
	}
</style>

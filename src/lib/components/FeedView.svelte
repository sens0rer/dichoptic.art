<script lang="ts">
	import FilterBar from './FilterBar.svelte';
	import Grid from './Grid.svelte';
	import type { Entry, Filters, Sort } from '#lib/query';

	let {
		data,
		showQuery = true
	}: {
		data: {
			entries: Entry[];
			cursor: string | null;
			filters: Filters;
			sort: Sort;
			ctx: string;
			presets: { code: string; name: string }[];
		};
		showQuery?: boolean;
	} = $props();
</script>

{#key data.ctx}
	<FilterBar filters={data.filters} sort={data.sort} presets={data.presets} {showQuery} />
	<Grid entries={data.entries} cursor={data.cursor} ctx={data.ctx} />
{/key}

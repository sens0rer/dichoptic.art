<script lang="ts">
	import { LABELS } from '#lib/vocab';

	let {
		fields
	}: {
		fields: {
			dimension: string | null;
			medium: string | null;
			alteration: string | null;
			chromacy: string | null;
			chromacyType: string | null;
			filterInfo: string | null;
		};
	} = $props();

	const rows = $derived(
		[
			['Dimension', fields.dimension, 'dimension'],
			['Medium', fields.medium, 'medium'],
			['Alteration', fields.alteration, 'alteration'],
			['Chromacy', fields.chromacy, 'chromacy'],
			['Chromacy type', fields.chromacyType, 'chromacyType'],
			['Filters', fields.filterInfo, null]
		].filter((r) => r[1]) as [string, string, string | null][]
	);
</script>

{#if rows.length}
	<ul class="chips">
		{#each rows as [label, value, key] (label)}
			<li class="chip" title={label}>
				<span class="muted">{label}:</span>
				{#if key}
					<a href="/search?{key}={encodeURIComponent(value)}">{LABELS[value] ?? value}</a>
				{:else}
					{value}
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	ul {
		list-style: none;
		padding: 0;
		margin: 0 0 1em;
	}
</style>

<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();

	function filter(lang: string, hidden: boolean) {
		const q = new URLSearchParams();
		if (lang) q.set('lang', lang);
		if (hidden) q.set('hidden', '1');
		void goto(`?${q}`, { reset: false });
	}
</script>

<svelte:head><title>{data.category.name} · Admin</title></svelte:head>

<main>
	<div class="top"><a href="/synesthesia/admin">← Items</a></div>
	<h1>{data.category.name}</h1>

	<div class="filters">
		<label>
			Language
			<select value={data.filter.lang} onchange={(e) => filter(e.currentTarget.value, data.filter.hidden)}>
				<option value="">all</option>
				{#each data.langs as l (l)}<option value={l}>{l}</option>{/each}
			</select>
		</label>
		{#if data.hiddenCount}
			<label class="check">
				<input type="checkbox" checked={data.filter.hidden} onchange={(e) => filter(data.filter.lang, e.currentTarget.checked)} />
				Show hidden ({data.hiddenCount})
			</label>
		{/if}
		<span class="muted">{data.items.length} item{data.items.length === 1 ? '' : 's'}</span>
	</div>

	<ul class="items">
		{#each data.items as i (i.id)}
			<li class:hidden={i.hidden}>
				<a href="/synesthesia/admin/item/{i.id}">
					<span class="head">
						{#if i.lang}<span class="lang">{i.lang}</span>{/if}
						{#if i.title}<strong>{i.title}</strong>{/if}
						{#if i.hidden}<span class="badge">hidden</span>{/if}
					</span>
					<span class="preview" lang={i.lang}>{i.preview}</span>
					<span class="meta">
						{i.source}
						{#if i.tags} · {i.tags.genre} · {i.tags.theme} · {i.tags.era}{/if}
						· {i.attempts} attempt{i.attempts === 1 ? '' : 's'}{#if i.finished}, {i.finished} finished{/if}
					</span>
				</a>
			</li>
		{/each}
	</ul>
</main>

<style>
	main {
		max-width: 900px;
		margin: 0 auto;
		padding: 16px 16px 48px;
	}
	.top {
		font-size: 0.9rem;
	}
	h1 {
		font-size: 1.4rem;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 14px;
		margin-bottom: 12px;
	}
	.filters label {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		color: var(--syn-text);
		font-size: 0.9rem;
	}
	.filters select {
		width: auto;
	}
	.check input {
		width: 18px;
		height: 18px;
	}
	.muted {
		color: var(--syn-muted);
		font-size: 0.85rem;
	}
	.items {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.items li {
		border-bottom: 1px solid var(--syn-line);
	}
	.items li.hidden {
		opacity: 0.55;
	}
	.items a {
		display: grid;
		gap: 3px;
		padding: 10px 2px;
		color: var(--syn-text);
		text-decoration: none;
		min-width: 0;
	}
	.items a:hover .preview {
		text-decoration: underline;
	}
	.head {
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	.lang {
		font-size: 0.75rem;
		padding: 0 6px;
		border: 1px solid var(--syn-line);
		border-radius: 4px;
		color: var(--syn-muted);
	}
	.badge {
		font-size: 0.75rem;
		color: #6b1010;
	}
	.preview {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		font-size: 0.8rem;
		color: var(--syn-muted);
		overflow-wrap: anywhere;
	}
</style>

<script lang="ts">
	import { untrack } from 'svelte';
	import { entryHref, type Entry } from '#lib/query';
	import { plainText } from '#lib/links';
	import { thumbSrcset, thumbUrl } from '#lib/urls';

	let {
		entries,
		cursor,
		ctx
	}: { entries: Entry[]; cursor: string | null; ctx: string } = $props();

	// Seeded once; pages re-mount the grid with {#key} when the query changes.
	let items = $state<Entry[]>(untrack(() => entries));
	let next = $state<string | null>(untrack(() => cursor));
	let loading = $state(false);
	let failed = $state(false);
	const filtered = $derived([...new URLSearchParams(ctx).keys()].some((k) => k !== 'sort'));

	async function more() {
		if (!next || loading) return;
		loading = true;
		failed = false;
		try {
			const params = new URLSearchParams(ctx);
			params.set('cursor', next);
			const res = await fetch(`/api/feed?${params}`);
			if (!res.ok) throw new Error();
			const data = await res.json();
			// Like counts can shift between pages, so skip anything already shown.
			const seen = new Set(items.map((e) => e.type + e.id));
			items = [...items, ...data.entries.filter((e: Entry) => !seen.has(e.type + e.id))];
			next = data.cursor;
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	const params = $derived(new URLSearchParams(ctx));
</script>

{#if items.length === 0}
	<div class="empty">
		{#if filtered}
			<p>No matches.</p>
			<a class="btn" href="/">Clear search and filters</a>
		{:else}
			<p>Nothing here yet.</p>
			<a class="btn" href="/upload">Upload the first pair</a>
		{/if}
	</div>
{:else}
	<ul class="grid">
		{#each items as e (e.type + e.id)}
			<li>
				<a href={entryHref(e, params)} class="card">
					<img
						src={thumbUrl(e.thumbPrefix, 800)}
						srcset={thumbSrcset(e.thumbPrefix)}
						sizes="(min-width: 900px) 33vw, 100vw"
						alt={e.title ?? 'Untitled'}
						loading="lazy"
					/>
					<span class="meta">
						<span class="title">{e.title ?? 'Untitled'}</span>
						<span class="muted small">
							{#if e.type === 'collection'}{e.count} {e.count === 1 ? 'pair' : 'pairs'} ·{/if}
							♥ {e.likeCount}
						</span>
					</span>
					{#if e.submittedBy || e.credit}
						<span class="muted small credit">{e.submittedBy ?? plainText(e.credit)}</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
	{#if next}
		<div class="more">
			<button onclick={more} disabled={loading}>{loading ? 'Loading…' : 'Load more'}</button>
			{#if failed}<p class="error">Could not load more. Try again.</p>{/if}
		</div>
	{/if}
{/if}

<style>
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
		gap: 1em;
	}
	.card {
		display: block;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.card:hover {
		border-color: #555;
		text-decoration: none;
	}
	/* Fixed tile shape so rows line up; whole pair always visible, letterboxed in the card colour. */
	img {
		display: block;
		width: 100%;
		aspect-ratio: 5 / 2;
		object-fit: contain;
		background: var(--surface);
	}
	.meta {
		display: flex;
		justify-content: space-between;
		gap: 0.5em;
		padding: 0.55em 0.8em 0.1em;
	}
	.title {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.credit {
		display: block;
		padding: 0 0.8em 0.6em;
	}
	.card .meta:last-child {
		padding-bottom: 0.6em;
	}
	.more {
		text-align: center;
		margin: 1.5em 0;
	}
</style>

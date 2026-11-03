<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();

	interface Song {
		id: number;
		artist: string;
		track: string;
		album: string | null;
		lines: string[];
	}

	let q = $state('');
	let searching = $state(false);
	let error = $state('');
	let songs = $state<Song[] | null>(null);
	let song = $state<Song | null>(null);
	let chosen = $state<Set<number>>(new Set());
	// Pasting instead of searching.
	let paste = $state(false);
	let artist = $state('');
	let track = $state('');
	let pasted = $state('');

	async function search(e: SubmitEvent) {
		e.preventDefault();
		if (q.trim().length < 2) return;
		searching = true;
		error = '';
		songs = null;
		song = null;
		try {
			const res = await fetch(`/synesthesia/api/lyrics?${new URLSearchParams({ q })}`);
			const data = await res.json();
			if (!res.ok) error = data.error ?? 'Search failed.';
			else songs = data.songs;
		} catch {
			error = 'No connection. Try again, or paste the lyrics.';
		} finally {
			searching = false;
		}
	}

	function open(s: Song) {
		song = s;
		chosen = new Set();
	}

	function toggle(i: number) {
		const next = new Set(chosen);
		if (next.has(i)) next.delete(i);
		else next.add(i);
		chosen = next;
	}

	const excerpt = $derived(
		paste ? pasted : song ? song.lines.filter((_, i) => chosen.has(i)).join('\n') : ''
	);
</script>

<svelte:head><title>Add a song · Colour tests</title></svelte:head>

<main>
	<div class="top"><a href="/synesthesia">← Tests</a></div>
	<h1>Add a song</h1>

	{#if form?.error}<p class="notice">{form.error}</p>{/if}

	{#if !paste}
		<form class="search" onsubmit={search}>
			<input bind:value={q} placeholder="Song title or artist" autocomplete="off" />
			<button class="primary" disabled={searching || q.trim().length < 2}>{searching ? 'Searching…' : 'Search'}</button>
		</form>
		<button class="link" onclick={() => (paste = true)}>Or paste the lyrics yourself</button>

		{#if error}<p class="notice">{error}</p>{/if}

		{#if songs && !song}
			{#if !songs.length}
				<p>Nothing found. Try the title in another spelling, or paste the lyrics.</p>
			{/if}
			<ul class="songs">
				{#each songs as s (s.id)}
					<li>
						<button onclick={() => open(s)}>
							<strong>{s.track}</strong>
							<span>{s.artist}{s.album ? ` · ${s.album}` : ''}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if song}
			<div class="picked">
				<div>
					<strong>{song.track}</strong> <span class="muted">{song.artist}</span>
				</div>
				<button class="link" onclick={() => (song = null)}>Back to results</button>
			</div>
			<p class="hint">Tap the lines you want to colour.</p>
			<ol class="lines">
				{#each song.lines as line, i (i)}
					{#if line}
						<li>
							<button class:on={chosen.has(i)} onclick={() => toggle(i)} aria-pressed={chosen.has(i)}>{line}</button>
						</li>
					{:else}
						<li class="gap"></li>
					{/if}
				{/each}
			</ol>
		{/if}
	{:else}
		<div class="paste">
			<label>Artist <input bind:value={artist} autocomplete="off" /></label>
			<label>Song <input bind:value={track} autocomplete="off" /></label>
			<label>Lines to colour <textarea bind:value={pasted} rows="8"></textarea></label>
			<button class="link" onclick={() => (paste = false)}>Search instead</button>
		</div>
	{/if}

	{#if excerpt.trim()}
		<form method="post" action="?/add" use:enhance class="add">
			<input type="hidden" name="artist" value={paste ? artist : song?.artist} />
			<input type="hidden" name="track" value={paste ? track : song?.track} />
			<input type="hidden" name="excerpt" value={excerpt} />
			<input type="hidden" name="lrclibId" value={paste ? '' : song?.id} />
			<button class="primary">Add and start colouring</button>
		</form>
	{/if}
</main>

<style>
	main {
		max-width: 640px;
		margin: 0 auto;
		padding: 16px 16px 120px;
		display: grid;
		gap: 12px;
	}
	.top {
		font-size: 0.9rem;
	}
	h1 {
		font-size: 1.4rem;
		margin: 0;
	}
	.notice {
		padding: 8px 12px;
		background: var(--syn-surface);
		border-radius: 8px;
		margin: 0;
	}
	.search {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px;
	}
	.search input {
		font-size: 1.05rem;
	}
	button.link {
		justify-self: start;
		background: none;
		border: none;
		padding: 0;
		color: #102a5c;
		font-size: 0.9rem;
	}
	ul,
	ol {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 6px;
	}
	.songs button {
		width: 100%;
		display: grid;
		justify-items: start;
		text-align: left;
		gap: 2px;
		padding: 10px 12px;
	}
	.songs span,
	.muted {
		color: var(--syn-muted);
		font-size: 0.85rem;
	}
	.picked {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	.hint {
		margin: 0;
		font-size: 0.9rem;
	}
	.lines {
		gap: 4px;
	}
	.lines button {
		width: 100%;
		justify-content: flex-start;
		text-align: left;
		padding: 8px 12px;
		font-size: 1.05rem;
	}
	.lines button.on {
		background: #222;
		color: #eee;
		border-color: #222;
	}
	.lines .gap {
		height: 10px;
	}
	.paste {
		display: grid;
		gap: 10px;
	}
	.paste label {
		display: grid;
		gap: 4px;
		font-size: 0.9rem;
		color: var(--syn-text);
	}
	/* Always reachable at the bottom while picking lines. */
	.add {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
		background: var(--syn-surface);
		border-top: 1px solid var(--syn-line);
		display: flex;
		justify-content: center;
	}
	.add button {
		width: min(100%, 608px);
		padding: 0.8em;
	}
</style>

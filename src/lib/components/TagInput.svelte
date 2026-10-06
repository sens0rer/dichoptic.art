<script lang="ts">
	let {
		tags = $bindable(),
		placeholder = 'Add a tag…',
		id
	}: { tags: string[]; placeholder?: string; id?: string } = $props();

	let draft = $state('');
	let suggestions = $state<string[]>([]);
	let timer: ReturnType<typeof setTimeout> | undefined;
	const listId = `tags-${Math.random().toString(36).slice(2)}`;

	const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);

	function add(raw: string) {
		for (const part of raw.split(',')) {
			const t = norm(part);
			if (t && !tags.includes(t)) tags = [...tags, t];
		}
		draft = '';
		suggestions = [];
	}

	function onInput() {
		if (draft.includes(',')) return add(draft);
		clearTimeout(timer);
		const q = draft.trim();
		if (!q) {
			suggestions = [];
			return;
		}
		timer = setTimeout(async () => {
			const res = await fetch(`/api/tags?q=${encodeURIComponent(q)}`);
			if (res.ok) suggestions = await res.json();
		}, 150);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			add(draft);
		} else if (e.key === 'Backspace' && !draft && tags.length) {
			tags = tags.slice(0, -1);
		}
	}
</script>

<div class="tags">
	{#if tags.length}
		<div class="chips">
			{#each tags as t (t)}
				<span class="chip">
					{t}
					<button type="button" aria-label="Remove {t}" onclick={() => (tags = tags.filter((x) => x !== t))}>×</button>
				</span>
			{/each}
		</div>
	{/if}
	<input
		{id}
		list={listId}
		{placeholder}
		bind:value={draft}
		oninput={onInput}
		onkeydown={onKey}
		onblur={() => draft && add(draft)}
		maxlength="40"
		autocomplete="off"
	/>
	<datalist id={listId}>
		{#each suggestions as s (s)}<option value={s}></option>{/each}
	</datalist>
</div>

<style>
	.tags {
		display: grid;
		gap: 0.5em;
	}
</style>

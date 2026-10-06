<script lang="ts">
	import { untrack } from 'svelte';
	import TagInput from './TagInput.svelte';
	import type { Meta, Preset } from '#lib/formTypes';
	import { FILTER_CATEGORIES, LABELS } from '#lib/vocab';

	let {
		values = $bindable(),
		errors = {},
		presets,
		titleRequired = true,
		inherit = null,
		inheritedMedium = null,
		showTitle = true,
		subject = 'pair',
		showPrivate = false
	}: {
		values: Meta;
		errors?: Record<string, string>;
		presets: Preset[];
		titleRequired?: boolean;
		// Set for images inside a collection: blank fields inherit the collection's value.
		inherit?: string | null;
		inheritedMedium?: string | null;
		showTitle?: boolean;
		subject?: 'pair' | 'collection';
		showPrivate?: boolean;
	} = $props();

	const blank = $derived(inherit ?? 'Not specified');
	const levelPresets = $derived(presets.filter((p) => p.chromacy === values.chromacy));
	const typeApplies = $derived(!!values.chromacy && values.chromacy !== 'none');
	const photography = $derived((values.medium || inheritedMedium) === 'photography');

	let sameAuthor = $state(untrack(() => !!values.submittedBy && values.submittedBy === values.author));
	let other = $state(
		untrack(() => !!values.chromacyType && !presets.some((p) => p.code === values.chromacyType))
	);

	$effect(() => {
		if (sameAuthor) values.author = values.submittedBy;
	});

	let lastChromacy = untrack(() => values.chromacy);
	$effect(() => {
		if (values.chromacy !== lastChromacy) {
			lastChromacy = values.chromacy;
			values.chromacyType = '';
			other = false;
		}
	});

	// Selecting words and pasting a web address turns them into a link, like most editors do.
	function pasteLink(e: ClipboardEvent) {
		const input = e.currentTarget as HTMLInputElement;
		const { selectionStart: a, selectionEnd: b } = input;
		const pasted = e.clipboardData?.getData('text').trim() ?? '';
		if (a === null || b === null || a === b || !/^(https?:\/\/)?[^\s/()[\]]+\.[^\s()[\]]+$/i.test(pasted)) return;
		e.preventDefault();
		const word = input.value.slice(a, b);
		const link = `[${word}](${pasted})`;
		values.credit = input.value.slice(0, a) + link + input.value.slice(b);
		const end = a + link.length;
		queueMicrotask(() => input.setSelectionRange(end, end));
	}

	function pickType(v: string) {
		other = v === '__other';
		values.chromacyType = other ? '' : v;
	}

	const typeSelect = $derived(
		other ? '__other' : levelPresets.some((p) => p.code === values.chromacyType) ? values.chromacyType : ''
	);
</script>

{#if showTitle}
	<div class="field">
		<label for="m-title">Title{#if titleRequired}<span class="req" title="Required"> *</span>{/if}</label>
		<input id="m-title" bind:value={values.title} maxlength="200" required={titleRequired} />
		{#if errors.title}<span class="error">{errors.title}</span>{/if}
	</div>
{/if}
<div class="field">
	<label for="m-desc">Description</label>
	<textarea id="m-desc" bind:value={values.description} maxlength="5000"></textarea>
	{#if errors.description}<span class="error">{errors.description}</span>{/if}
</div>

{#if showPrivate}
	<div class="field">
		<label class="inline check">
			<input type="checkbox" bind:checked={values.private} />
			<span>
				Private: only you can see this
				<span class="muted small">
					(site admins can too; it never appears in Browse, search or on other pages)</span
				>
			</span>
		</label>
	</div>
{/if}

<fieldset>
	<legend>Credit</legend>
	<div class="grid2">
		<div class="field" style="grid-column: 1 / -1">
			<label for="m-credit">Credit</label>
			<input id="m-credit" bind:value={values.credit} onpaste={pasteLink} maxlength="500" />
			{#if errors.credit}<span class="error">{errors.credit}</span>{/if}
		</div>
		<div class="field">
			<label for="m-by">Submitted by</label>
			<input id="m-by" bind:value={values.submittedBy} maxlength="100" />
		</div>
		<div class="field">
			<label for="m-author">Author</label>
			<input id="m-author" bind:value={values.author} maxlength="100" disabled={sameAuthor} />
			<label class="inline small" style="margin-top: 0.35em">
				<input type="checkbox" bind:checked={sameAuthor} /> Same as submitted by
			</label>
		</div>
	</div>
</fieldset>

<fieldset>
	<legend>About the {subject}</legend>
	<div class="grid2">
		<div class="field">
			<label for="m-date">Date</label>
			<input id="m-date" type="date" bind:value={values.date} />
			{#if inherit}<span class="muted small">Leave empty to use the collection’s date.</span>{/if}
			{#if errors.date}<span class="error">{errors.date}</span>{/if}
		</div>
		{#each FILTER_CATEGORIES as cat (cat.key)}
			<div class="field">
				<label for="m-{cat.key}">{cat.label}</label>
				<select id="m-{cat.key}" bind:value={values[cat.key]}>
					<option value="">{blank}</option>
					{#each cat.values as v (v)}<option value={v}>{LABELS[v]}</option>{/each}
				</select>
			</div>
		{/each}
		{#if typeApplies}
			<div class="field">
				<label for="m-ctype">Dichoptic color type</label>
				<select id="m-ctype" value={typeSelect} onchange={(e) => pickType(e.currentTarget.value)}>
					<option value="">Not specified</option>
					{#each levelPresets as p (p.code)}<option value={p.code}>{p.code} — {p.name}</option>{/each}
					<option value="__other">Other…</option>
				</select>
				{#if other}
					<input
						style="margin-top: 0.4em"
						bind:value={values.chromacyType}
						placeholder="Describe the type"
						maxlength="100"
					/>
				{/if}
			</div>
		{/if}
	</div>
	{#if photography}
		<div class="field">
			<label for="m-filter">Color filter information (if you have used color filters for your photograph)</label>
			<input id="m-filter" bind:value={values.filterInfo} maxlength="500" />
		</div>
	{/if}
	<div class="field">
		<label for="m-tags">Tags</label>
		<TagInput id="m-tags" bind:tags={values.tags} />
		{#if inherit}<span class="muted small">Collection tags are added automatically.</span>{/if}
	</div>
</fieldset>

<style>
	.check {
		align-items: flex-start;
		color: var(--text);
		font-size: 0.95rem;
	}
	fieldset {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		margin: 0 0 1em;
		padding: 0.8em 1em 0.2em;
	}
	legend {
		color: var(--muted);
		font-size: 0.85rem;
		padding: 0 0.4em;
	}
</style>

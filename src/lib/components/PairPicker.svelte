<script module lang="ts">
	// With several pickers on a page (collections), a paste goes to the one you touched last.
	let lastTouched: symbol | null = null;
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { api } from '#lib/consent.svelte';
	import { ACCEPTED_TYPES, MAX_FILE_BYTES } from '#lib/vocab';
	import type { PairRef } from '#lib/formTypes';
	import type { SourceMode } from '#lib/vocab';

	interface Slot {
		name: string;
		url: string;
		w: number;
		h: number;
		progress: number;
		id: string | null;
		error: string | null;
	}

	let {
		pair = $bindable(null),
		busy = $bindable(false),
		label = ''
	}: { pair: PairRef | null; busy?: boolean; label?: string } = $props();

	let mode = $state<SourceMode>('two_files');
	let slots = $state<Record<'left' | 'right', Slot | null>>({ left: null, right: null });
	let over = $state(false);
	const me = Symbol();
	lastTouched = me;

	const sides = $derived(mode === 'single_file' ? (['left'] as const) : (['left', 'right'] as const));
	const mismatch = $derived(
		mode === 'two_files' &&
			slots.left &&
			slots.right &&
			slots.left.w > 0 &&
			slots.right.w > 0 &&
			(slots.left.w !== slots.right.w || slots.left.h !== slots.right.h)
	);

	$effect(() => {
		busy = sides.some((s) => slots[s] && slots[s]!.id === null && !slots[s]!.error);
		const ready = sides.every((s) => slots[s]?.id);
		pair = ready
			? { mode, left: slots.left!.id!, right: mode === 'two_files' ? slots.right!.id! : undefined }
			: null;
	});

	function clear(side: 'left' | 'right') {
		const s = slots[side];
		if (s) URL.revokeObjectURL(s.url);
		slots[side] = null;
	}

	function setMode(next: SourceMode) {
		if (next === mode) return;
		clear('left');
		clear('right');
		mode = next;
	}

	onDestroy(() => {
		for (const s of [slots.left, slots.right]) if (s) URL.revokeObjectURL(s.url);
	});

	const dims = (url: string) =>
		new Promise<{ w: number; h: number }>((resolve) => {
			const img = new Image();
			img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
			img.onerror = () => resolve({ w: 0, h: 0 });
			img.src = url;
		});

	function put(url: string, file: File, onProgress: (p: number) => void) {
		return new Promise<boolean>((resolve) => {
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', url);
			xhr.setRequestHeader('content-type', file.type);
			xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
			xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
			xhr.onerror = () => resolve(false);
			xhr.send(file);
		});
	}

	async function take(side: 'left' | 'right', file: File) {
		clear(side);
		const url = URL.createObjectURL(file);
		const slot: Slot = { name: file.name, url, w: 0, h: 0, progress: 0, id: null, error: null };
		slots[side] = slot;
		const fail = (error: string) => {
			slots[side] = { ...slot, error };
		};
		if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type))
			return fail('Only JPEG, PNG and WebP are accepted');
		if (file.size > MAX_FILE_BYTES) return fail('Files can be at most 20 MB');

		const [size, presign] = await Promise.all([
			dims(url),
			api<{ uploads: { id: string; url: string }[] }>('/api/upload/presign', {
				json: { files: [{ type: file.type, size: file.size }] }
			})
		]);
		const current = slots[side];
		if (!current || current.url !== url) return; // replaced while waiting
		current.w = size.w;
		current.h = size.h;
		if (!presign.ok) return fail(presign.data.error ?? 'Could not start the upload');
		const { id, url: target } = presign.data.uploads[0];
		const ok = await put(target, file, (p) => {
			if (slots[side]?.url === url) slots[side]!.progress = p;
		});
		if (slots[side]?.url !== url) return;
		if (ok) slots[side]!.id = id;
		else fail('Upload failed. Try again.');
	}

	function pick(side: 'left' | 'right', files: FileList | null) {
		if (files?.[0]) void take(side, files[0]);
	}

	// Files dropped or pasted on the area itself fill the empty sides in order.
	function place(files: File[]) {
		if (!files.length) return;
		if (mode === 'single_file') return void take('left', files[0]);
		const empty = sides.filter((s) => !slots[s]);
		const targets = empty.length ? empty : sides;
		files.slice(0, targets.length).forEach((f, i) => void take(targets[i], f));
	}

	const images = (list?: FileList | null) =>
		[...(list ?? [])].filter((f) => f.type.startsWith('image/'));

	function drop(e: DragEvent, side?: 'left' | 'right') {
		e.preventDefault();
		e.stopPropagation();
		over = false;
		const files = images(e.dataTransfer?.files);
		if (side && files.length) void take(side, files[0]);
		else place(files);
	}

	function paste(e: ClipboardEvent) {
		if (lastTouched !== me) return;
		const files = images(e.clipboardData?.files);
		if (!files.length) return;
		e.preventDefault();
		place(files);
	}
</script>

<svelte:window onpaste={paste} />

<div
	class="picker"
	class:over
	role="group"
	aria-label={label || 'Image files'}
	onpointerenter={() => (lastTouched = me)}
	onfocusin={() => (lastTouched = me)}
	ondragover={(e) => {
		e.preventDefault();
		over = true;
	}}
	ondragleave={() => (over = false)}
	ondrop={(e) => drop(e)}
>
	<div class="row modes" role="radiogroup" aria-label="Upload mode">
		<button type="button" class:active={mode === 'two_files'} onclick={() => setMode('two_files')}>
			Left and right image
		</button>
		<button type="button" class:active={mode === 'single_file'} onclick={() => setMode('single_file')}>
			One image (side by side)
		</button>
	</div>
	<p class="muted small">
		{mode === 'single_file'
			? 'One file whose left half is the left image and right half is the right image. Kept exactly as uploaded.'
			: 'A separate left and right image. Drop or paste both onto this area, or one per box.'}
		JPEG, PNG or WebP, up to 20 MB each.
	</p>

	<div class="slots" class:two={mode === 'two_files'}>
		{#each sides as side (side)}
			{@const s = slots[side]}
			<div class="slot">
				{#if s}
					<img src={s.url} alt="{side} preview" />
					<div class="info small">
						<span>{mode === 'two_files' ? side + ': ' : ''}{s.name}</span>
						{#if s.w}<span class="muted">{s.w}×{s.h}</span>{/if}
					</div>
					{#if s.error}
						<span class="error">{s.error}</span>
					{:else if !s.id}
						<progress max="1" value={s.progress}></progress>
					{/if}
					<button type="button" class="link small" onclick={() => clear(side)}>Remove</button>
				{:else}
					<label class="drop" ondragover={(e) => e.preventDefault()} ondrop={(e) => drop(e, side)}>
						<span>{mode === 'two_files' ? (side === 'left' ? 'Left image' : 'Right image') : 'Image'}</span>
						<span class="muted small">Drop, paste or click to browse</span>
						<input
							class="sr-only"
							type="file"
							accept={ACCEPTED_TYPES.join(',')}
							onchange={(e) => pick(side, e.currentTarget.files)}
						/>
					</label>
				{/if}
			</div>
		{/each}
	</div>

	{#if mismatch}
		<p class="warn small">
			Heads up: the two images have different sizes ({slots.left?.w}×{slots.left?.h} and
			{slots.right?.w}×{slots.right?.h}). You can still submit.
		</p>
	{/if}

	{#if mode === 'two_files' && sides.every((s) => slots[s]?.url)}
		<div class="preview" aria-label="Preview of the image">
			<span class="muted small">Preview</span>
			<div class="pairrow">
				{#each sides as side (side)}
					<img src={slots[side]!.url} alt="" />
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.picker {
		border: 1px dashed var(--border);
		border-radius: var(--radius);
		padding: 1em;
		margin-bottom: 1em;
		transition: border-color 0.15s;
	}
	.picker.over {
		border-color: var(--accent);
		background: var(--surface);
	}
	.modes {
		margin-bottom: 0.6em;
	}
	.slots {
		display: grid;
		gap: 0.8em;
	}
	.slots.two {
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}
	.slot {
		display: grid;
		gap: 0.3em;
		align-content: start;
	}
	.slot img {
		width: 100%;
		max-height: 220px;
		object-fit: contain;
		background: #000;
		border-radius: 4px;
	}
	.drop {
		display: grid;
		place-content: center;
		gap: 0.2em;
		text-align: center;
		min-height: 140px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-size: 1rem;
		cursor: pointer;
	}
	.drop:hover,
	.drop:focus-within {
		border-color: #666;
	}
	.info {
		display: flex;
		justify-content: space-between;
		gap: 0.5em;
		overflow: hidden;
	}
	.info span:first-child {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	progress {
		width: 100%;
	}
	.warn {
		color: #fdd663;
	}
	.preview {
		margin-top: 0.8em;
	}
	.pairrow {
		display: flex;
		gap: 4px;
		justify-content: center;
		background: #000;
		border-radius: 4px;
		padding: 4px;
	}
	.pairrow img {
		min-width: 0;
		flex: 1 1 0;
		max-height: 320px;
		object-fit: contain;
	}
</style>

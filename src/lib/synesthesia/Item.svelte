<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount, untrack } from 'svelte';
	import type { PageData } from '../../routes/synesthesia/a/[id]/$types';
	import Marker from './Marker.svelte';
	import MathMarker from './MathMarker.svelte';
	import Picker from './Picker.svelte';
	import { colour as makeColour, css } from './okhsl';
	import { outbox, pendingFor, send, startOutbox, uid, type Answer } from './outbox.svelte';
	import { allCovered, coveredMask, nextUncovered, parse, type Span, type UnitKind } from './segment';

	// One item being marked. Created afresh for every item (the page keys it by attempt id), so
	// nothing from the previous item carries over.
	let { data }: { data: PageData } = $props();

	// Scripts written right to left.
	const RTL = new Set(['ar', 'he']);

	const parsed = $derived(parse(data.stimulus.body, data.stimulus.unit as UnitKind, data.stimulus.lang));

	// Answers in force for this item: what the server has, plus anything still in the outbox.
	type Mark = { clientId: string; kind: 'colour' | 'none' | 'note'; start: number; end: number };
	let marks = $state<Mark[]>([]);
	const spans = $derived(marks.filter((m) => m.kind !== 'note'));
	const covered = $derived(coveredMask(parsed.graphemes.length, spans));
	const finished = $derived(allCovered(parsed, spans));

	let selection = $state<Span | null>(null);
	// The picker starts every selection at the same neutral grey, so one answer never pulls the next.
	let h = $state(0);
	let s = $state(0);
	let l = $state(0.5);
	let note = $state('');
	let noteOpen = $state(false);
	let busy = $state(false);
	let previous = $state<{ h: number; s: number; l: number } | null>(null);
	// Answers made on this visit, newest last, for Undo.
	let history = $state<Mark[]>([]);

	let shownAt = 0;
	let lastAt: number | null = null;
	let panelHeight = $state(0);
	let wide = $state(false);

	function resetPicker() {
		h = 0;
		s = 0;
		l = 0.5;
		note = '';
		noteOpen = false;
	}

	onMount(() => {
		shownAt = performance.now();
		startOutbox();
		const media = matchMedia('(min-width: 900px)');
		wide = media.matches;
		media.addEventListener('change', (e) => (wide = e.matches));

		// Server answers + unsent ones, with undos applied.
		const local = pendingFor(data.attempt.id);
		const undone = new Set(local.filter((a) => a.kind === 'retract').map((a) => a.supersedes));
		marks = [
			...data.answers.map((a) => ({ clientId: a.clientId, kind: a.kind, start: a.start, end: a.end })),
			...local
				.filter((a) => a.kind !== 'retract')
				.map((a) => ({ clientId: a.clientId, kind: a.kind as Mark['kind'], start: a.start!, end: a.end! }))
		].filter((m) => !undone.has(m.clientId));

		if (data.position?.selection) {
			selection = data.position.selection;
			requestAnimationFrame(() => scrollTo(0, data.position!.scroll));
		} else selection = nextUncovered(parsed, spans, 0);

		addEventListener('scroll', savePositionSoon, { passive: true });
		return () => {
			removeEventListener('scroll', savePositionSoon);
			clearTimeout(positionTimer);
		};
	});

	function answer(kind: Mark['kind']) {
		if (!selection || busy) return;
		const now = performance.now();
		const a: Answer = {
			clientId: uid(),
			attemptId: data.attempt.id,
			kind,
			start: selection.start,
			end: selection.end,
			colour: kind === 'colour' ? makeColour(h, s, l) : null,
			note: note.trim() || null,
			supersedes: null,
			answeredAt: new Date().toISOString(),
			tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
			shownMs: Math.round(now - shownAt),
			sincePrevMs: lastAt === null ? null : Math.round(now - lastAt)
		};
		lastAt = now;
		send(a);
		const mark = { clientId: a.clientId, kind, start: a.start!, end: a.end! };
		marks = [...marks, mark];
		history = [...history, mark];
		if (kind === 'colour') previous = { h, s, l };
		resetPicker();
		if (kind === 'note') return;
		advance(selection.end);
	}

	// After an answer, a short pause, then the next unmarked word, so going through a text is
	// mostly "pick a colour, confirm" without autopilot clicking.
	function advance(from: number) {
		busy = true;
		const next = nextUncovered(parsed, spans, from);
		selection = null;
		setTimeout(() => {
			selection = next;
			busy = false;
		}, 280);
	}

	function undo() {
		const last = history.at(-1);
		if (!last || busy) return;
		send({
			clientId: uid(),
			attemptId: data.attempt.id,
			kind: 'retract',
			start: last.start,
			end: last.end,
			colour: null,
			note: null,
			supersedes: last.clientId,
			answeredAt: new Date().toISOString(),
			tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
			shownMs: Math.round(performance.now() - shownAt),
			sincePrevMs: null
		});
		history = history.slice(0, -1);
		marks = marks.filter((m) => m.clientId !== last.clientId);
		selection = { start: last.start, end: last.end };
		resetPicker();
	}

	function samePrevious() {
		if (!previous) return;
		({ h, s, l } = previous);
	}

	// "Continue where you left off": item, scroll and selection, saved on the server.
	let positionTimer: ReturnType<typeof setTimeout> | undefined;
	// Fixed for this component: it is created afresh for every item.
	const attemptId = untrack(() => data.attempt.id);
	function savePositionSoon() {
		clearTimeout(positionTimer);
		positionTimer = setTimeout(() => {
			void fetch('/synesthesia/api/position', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ attemptId, scroll: Math.round(scrollY), selection })
			}).catch(() => {});
		}, 800);
	}
	$effect(() => {
		void [selection?.start, selection?.end];
		untrack(savePositionSoon);
	});

	const selectedText = $derived(selection ? parsed.graphemes.slice(selection.start, selection.end).join('') : '');
</script>

<div class="layout" class:wide style="--panel: {wide ? 0 : panelHeight}px">
	<main>
		<div class="top">
			<a href="/synesthesia">← Tests</a>
			<span class="where">{data.stimulus.category}</span>
			<span class="sync" class:failing={outbox.failing} title="Answers not yet sent to the server">
				{#if outbox.pending}{outbox.pending} unsent{#if outbox.failing}, retrying{/if}{:else}Saved{/if}
			</span>
			<form method="post" action="?/next" use:enhance>
				<button class:primary={finished}>{finished ? 'Next text' : 'Skip'}</button>
			</form>
		</div>

		{#if finished}
			<p class="done-note">Every part is marked. You can still add or change answers, or go on to the next text.</p>
		{/if}

		{#if data.stimulus.title}<h1 class="title">{data.stimulus.title}</h1>{/if}
		{#if data.stimulus.unit === 'math'}
			<MathMarker
				body={data.stimulus.body}
				{parsed}
				{covered}
				bottomInset={wide ? 0 : panelHeight}
				disabled={busy}
				bind:selection
			/>
		{:else}
			<Marker
				{parsed}
				{covered}
				lang={data.stimulus.lang}
				rtl={RTL.has(data.stimulus.lang ?? '')}
				size={data.stimulus.unit === 'char' ? 40 : 22}
				byLetter={data.stimulus.unit === 'char'}
				bottomInset={wide ? 0 : panelHeight}
				disabled={busy}
				bind:selection
			/>
		{/if}
	</main>

	<aside class="panel" bind:clientHeight={panelHeight}>
		<div class="current">
			{#if selection}
				<span class="label">Selected</span> <span class="selected" lang={data.stimulus.lang}>{selectedText}</span>
			{:else}
				<span class="label">{finished ? 'All marked' : 'Tap a word to select it'}</span>
			{/if}
		</div>
		<Picker bind:h bind:s bind:l />
		{#if noteOpen}
			<div class="note">
				<textarea bind:value={note} rows="2" placeholder="Anything to add about this part (saved with your answer)"></textarea>
				<button onclick={() => answer('note')} disabled={!selection || !note.trim()}>Save note only</button>
			</div>
		{/if}
		<div class="actions">
			<button class="primary confirm" onclick={() => answer('colour')} disabled={!selection || busy}>
				<span class="swatch" style="background: {css(h, s, l)}"></span>Confirm
			</button>
			<button onclick={() => answer('none')} disabled={!selection || busy}>No colour</button>
			<button onclick={() => (noteOpen = !noteOpen)} class:on={noteOpen || note}>Note</button>
			<button onclick={samePrevious} disabled={!previous}>Same as previous</button>
			<button onclick={undo} disabled={!history.length || busy}>Undo</button>
		</div>
	</aside>
</div>

<style>
	.layout {
		padding: 12px 16px calc(var(--panel) + 16px);
		max-width: 1200px;
		margin: 0 auto;
	}
	.layout.wide {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 420px;
		gap: 28px;
		align-items: start;
		padding-bottom: 40px;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 14px;
		font-size: 0.9rem;
	}
	.title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--syn-muted);
		margin: 0 0 10px;
	}
	.where {
		flex: 1;
		color: var(--syn-muted);
	}
	.sync {
		color: var(--syn-muted);
		font-size: 0.8rem;
	}
	.sync.failing {
		color: #6b1010;
	}
	.done-note {
		padding: 8px 12px;
		background: var(--syn-surface);
		border-radius: 8px;
		font-size: 0.9rem;
	}
	.panel {
		background: var(--syn-surface);
		border-top: 1px solid var(--syn-line);
		padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 10;
		display: grid;
		gap: 10px;
	}
	.wide .panel {
		position: sticky;
		top: 16px;
		border: 1px solid var(--syn-line);
		border-radius: 12px;
		padding: 16px;
		--wheel: 200px;
	}
	.current {
		font-size: 0.85rem;
		min-height: 1.4em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.label {
		color: var(--syn-muted);
	}
	.selected {
		font-weight: 600;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.actions button {
		padding: 0.55em 0.8em;
	}
	.confirm {
		gap: 8px;
	}
	.swatch {
		/* Fixed size: as a flex item it would otherwise shrink to an oval. */
		flex: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 1.5px solid #eee;
	}
	button.on {
		border-color: #111;
	}
	.note {
		display: grid;
		gap: 6px;
	}
	.note textarea {
		min-height: 3em;
	}
	@media (max-width: 899px) {
		.panel {
			--wheel: 144px;
		}
		.actions {
			display: grid;
			grid-template-columns: 1.4fr 1fr 1fr;
		}
		.actions .confirm {
			grid-row: span 2;
			justify-content: center;
		}
	}
</style>

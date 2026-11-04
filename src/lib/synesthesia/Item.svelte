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
	// The picker starts every selection the same way, so one answer never pulls the next: knobs at
	// full saturation and middle lightness, but neutral grey shown (and saved, if confirmed as is)
	// until the wheel or a slider is touched.
	let h = $state(0);
	let s = $state(1);
	let l = $state(0.5);
	let fresh = $state(true);
	const GREY = { h: 0, s: 0, l: 0.5 };
	const shown = $derived(fresh ? GREY : { h, s, l });
	let note = $state('');
	let noteOpen = $state(false);
	let busy = $state(false);
	type Hsl = { h: number; s: number; l: number };
	// "Add colour" sets the picker's colour aside here and starts the picker afresh for the next one;
	// Confirm saves these and the picker's colour.
	let added = $state<Hsl[]>([]);
	// Every colour Confirm would save, in order.
	const all = $derived([...added, shown]);
	// Answers made on this visit, newest last, for Undo.
	let history = $state<Mark[]>([]);
	// The colours of this visit's colour answers, by client id, for "Copy colour". Only this visit:
	// the page never gets earlier colours from the server, so marking stays blind.
	type Colours = { added: Hsl[]; colour: Hsl };
	const coloursOf = new Map<string, Colours>();
	const latestColours = $derived.by(() => {
		const m = history.findLast((m) => m.kind === 'colour' && coloursOf.has(m.clientId));
		return m ? coloursOf.get(m.clientId)! : null;
	});

	let shownAt = 0;
	let lastAt: number | null = null;
	let panelHeight = $state(0);
	let wide = $state(false);

	function resetPicker() {
		h = 0;
		s = 1;
		l = 0.5;
		fresh = true;
		added = [];
		note = '';
		noteOpen = false;
		copying = false;
	}

	// More than one colour for one part: the picker's colour is set aside, and the picker starts
	// afresh (grey until touched) for the next.
	function addColour() {
		added = [...added, { ...shown }];
		h = 0;
		s = 1;
		l = 0.5;
		fresh = true;
	}
	const removeColour = (i: number) => (added = added.filter((_, k) => k !== i));

	// Equal stripes, left to right, for a set of colours.
	const stripes = (cs: Hsl[]) =>
		cs.length === 1
			? css(cs[0].h, cs[0].s, cs[0].l)
			: `linear-gradient(to right, ${cs.map((c, i) => `${css(c.h, c.s, c.l)} ${(i * 100) / cs.length}% ${((i + 1) * 100) / cs.length}%`).join(', ')})`;

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
				.filter((a) => a.kind === 'colour' || a.kind === 'none' || a.kind === 'note')
				.map((a) => ({ clientId: a.clientId, kind: a.kind as Mark['kind'], start: a.start!, end: a.end! }))
		].filter((m) => !undone.has(m.clientId));
		// "I know this song": the server's flag, or an unsent one, unless undone.
		const unsentFlag = local.filter((a) => a.kind === 'flag').at(-1);
		if (unsentFlag) knownId = unsentFlag.clientId;
		if (knownId && undone.has(knownId)) knownId = null;

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
			colour:
				kind !== 'colour'
					? null
					: all.length > 1
						? { ...makeColour(all[0].h, all[0].s, all[0].l), more: all.slice(1).map((c) => makeColour(c.h, c.s, c.l)) }
						: makeColour(shown.h, shown.s, shown.l),
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
		if (kind === 'colour') coloursOf.set(a.clientId, { added, colour: { ...shown } });
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

	// "I know this song" (song items): ticking records a flag answer, unticking undoes it, so the
	// history is kept like any other answer.
	let knownId = $state<string | null>(untrack(() => data.song?.knownId ?? null));
	function toggleKnown() {
		const base = {
			attemptId: data.attempt.id,
			start: null,
			end: null,
			colour: null,
			answeredAt: new Date().toISOString(),
			tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
			shownMs: Math.round(performance.now() - shownAt),
			sincePrevMs: null
		};
		if (knownId) {
			send({ ...base, clientId: uid(), kind: 'retract', note: null, supersedes: knownId });
			knownId = null;
		} else {
			const clientId = uid();
			send({ ...base, clientId, kind: 'flag', note: 'knows-song', supersedes: null });
			knownId = clientId;
		}
	}

	function useColours(c: Colours) {
		({ h, s, l } = c.colour);
		added = [...c.added];
		fresh = false;
		copying = false;
	}

	// "Copy colour": the next tap on the text picks a word coloured on this visit and copies its
	// colours into the picker; the selection stays where it was. "Previous" copies the latest.
	let copying = $state(false);
	let copyMiss = $state(false);
	let copyFrom: Span | null = null;
	function startCopy() {
		copyFrom = selection;
		copyMiss = false;
		copying = true;
	}
	$effect(() => {
		const tapped = selection;
		if (!copying) return;
		untrack(() => {
			if (tapped === copyFrom) return;
			// The most specific answer under the tap: the shortest, and of those the latest.
			const g = tapped?.start ?? -1;
			const under = history.filter((m) => m.kind === 'colour' && coloursOf.has(m.clientId) && m.start <= g && g < m.end);
			const shortest = Math.min(...under.map((m) => m.end - m.start));
			const found = under.findLast((m) => m.end - m.start === shortest);
			copyMiss = !found;
			if (found) useColours(coloursOf.get(found.clientId)!);
			selection = copyFrom;
		});
	});

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
	// In maths, the selected part typeset, not its symbols run together.
	let mathPreview = $state('');
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
		{#if data.song}
			<label class="known"><input type="checkbox" checked={!!knownId} onchange={toggleKnown} /> I know this song</label>
		{/if}
		{#if data.stimulus.unit === 'math'}
			<MathMarker
				body={data.stimulus.body}
				{parsed}
				{covered}
				bottomInset={wide ? 0 : panelHeight}
				disabled={busy}
				bind:selection
				bind:preview={mathPreview}
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
		<!-- Undo sits on this line, by the selection it gives back, so the actions below stay a
		     tidy block. -->
		<div class="head">
			<div class="current">
				{#if selection}
					<span class="label">Selected</span>
					{#if mathPreview}<span class="selected math-preview">{@html mathPreview}</span
						>{:else}<span class="selected" lang={data.stimulus.lang}>{selectedText}</span>{/if}
				{:else}
					<span class="label">{finished ? 'All marked' : 'Tap a word to select it'}</span>
				{/if}
			</div>
			<button class="undo" onclick={undo} disabled={!history.length || busy}>↶ Undo</button>
		</div>
		{#if copying}
			<div class="copying">
				<span>{copyMiss ? 'No colour from this visit there. Tap another word you coloured,' : 'Tap a word you coloured on this visit to copy its colour,'} or:</span>
				<button onclick={() => latestColours && useColours(latestColours)}>Previous</button>
				<button onclick={() => (copying = false)}>Cancel</button>
			</div>
		{/if}
		{#if added.length}
			<div class="added">
				<span class="label">Colours so far (tap to remove), then this one:</span>
				{#each added as c, i (i)}
					<button class="chip-colour" style="background: {css(c.h, c.s, c.l)}" onclick={() => removeColour(i)} aria-label="Remove colour {i + 1}"
					></button>
				{/each}
			</div>
		{/if}
		<Picker bind:h bind:s bind:l bind:fresh />
		{#if noteOpen}
			<div class="note">
				<textarea bind:value={note} rows="2" placeholder="Anything to add about this part (saved with your answer)"></textarea>
				<button onclick={() => answer('note')} disabled={!selection || !note.trim()}>Save note only</button>
			</div>
		{/if}
		<div class="actions">
			<button class="primary confirm" onclick={() => answer('colour')} disabled={!selection || busy}>
				<span class="swatch" style="background: {stripes(all)}"></span>Confirm
			</button>
			<button onclick={() => answer('none')} disabled={!selection || busy}>No colour</button>
			<button onclick={addColour} disabled={!selection || busy || added.length >= 9}>Add colour</button>
			<button onclick={() => (noteOpen = !noteOpen)} class:on={noteOpen || note}>Note</button>
			<button onclick={() => (copying ? (copying = false) : startCopy())} class:on={copying} disabled={!latestColours}>Copy colour</button>
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
	.known {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 12px;
		font-size: 0.9rem;
		color: var(--syn-text);
	}
	.known input {
		width: 22px;
		height: 22px;
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
	.head {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.undo {
		flex: none;
		padding: 0.3em 0.8em;
		font-size: 0.85rem;
	}
	.current {
		flex: 1;
		min-width: 0;
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
	.math-preview {
		font-weight: normal;
		font-size: 1.25em;
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
		gap: 10px;
	}
	/* The colour about to be confirmed, large enough to check at a glance. */
	.swatch {
		/* Fixed size: as a flex item it would otherwise shrink to an oval. */
		flex: none;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 2px solid #eee;
	}
	button.on {
		border-color: #111;
	}
	.copying {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 8px;
		padding: 8px 10px;
		border: 2px solid #111;
		border-radius: 8px;
		font-size: 0.85rem;
	}
	.copying span {
		flex: 1 1 100%;
	}
	.copying button {
		padding: 0.3em 0.9em;
	}
	.added {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
	}
	.added .label {
		width: 100%;
	}
	/* A colour set aside; large enough to tap. */
	.chip-colour {
		width: 36px;
		height: 36px;
		min-height: 0;
		padding: 0;
		border-radius: 50%;
		border: 2px solid #eee;
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
		/* On phones Confirm is a tall button: the colour sits above the word, big. */
		.actions .confirm {
			grid-row: span 2;
			flex-direction: column;
			justify-content: center;
			gap: 8px;
		}
		.actions .confirm .swatch {
			width: 52px;
			height: 52px;
		}
	}
</style>

<script lang="ts">
	import { goto } from '$app/navigation';

	let { prev, next }: { prev: string | null; next: string | null } = $props();

	// Horizontal swipe on the image area (marked data-swipe) steps to the previous/next pair.
	let start: { x: number; y: number } | null = null;

	function onTouchStart(e: TouchEvent) {
		const t = e.target as HTMLElement;
		start = e.touches.length === 1 && t.closest('[data-swipe]') ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
	}

	function onTouchEnd(e: TouchEvent) {
		if (!start) return;
		const dx = e.changedTouches[0].clientX - start.x;
		const dy = e.changedTouches[0].clientY - start.y;
		start = null;
		if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
		const to = dx > 0 ? prev : next;
		if (to) void goto(to);
	}

	function onKey(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
		if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
		const to = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : null;
		if (!to) return;
		e.preventDefault();
		void goto(to);
	}
</script>

<svelte:window onkeydown={onKey} ontouchstart={onTouchStart} ontouchend={onTouchEnd} />

{#if prev}
	<a class="btn" href={prev} aria-label="Previous (left arrow)">←</a>
{:else}
	<span class="btn off" aria-disabled="true" aria-label="No previous">←</span>
{/if}
{#if next}
	<a class="btn" href={next} aria-label="Next (right arrow)">→</a>
{:else}
	<span class="btn off" aria-disabled="true" aria-label="No next">→</span>
{/if}

<style>
	.off {
		opacity: 0.35;
		cursor: default;
	}
</style>

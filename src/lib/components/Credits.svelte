<script lang="ts">
	import { parseCredit } from '#lib/credit';

	let {
		credit,
		submittedBy,
		author
	}: {
		credit: string | null;
		submittedBy: string | null;
		author: string | null;
	} = $props();
</script>

{#if credit || submittedBy || author}
	<dl class="credits">
		{#if credit}
			<dt>Credit</dt>
			<dd>
				{#each parseCredit(credit) as part, i (i)}{#if part.href}<a
							href={part.href}
							rel="noopener noreferrer nofollow"
							target="_blank">{part.text}</a
						>{:else}{part.text}{/if}{/each}
			</dd>
		{/if}
		{#if author}
			<dt>Author</dt>
			<dd>{author}</dd>
		{/if}
		{#if submittedBy}
			<dt>Submitted by</dt>
			<dd><a href="/by/{encodeURIComponent(submittedBy.trim().replace(/\s+/g, ' ').toLowerCase())}">{submittedBy}</a></dd>
		{/if}
	</dl>
{/if}

<style>
	.credits {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.2em 1em;
		margin: 0 0 1em;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		font-weight: 500;
	}
</style>

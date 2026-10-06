<script lang="ts">
	let {
		creditName,
		creditUrl,
		submittedBy,
		author
	}: {
		creditName: string | null;
		creditUrl: string | null;
		submittedBy: string | null;
		author: string | null;
	} = $props();
</script>

{#if creditName || submittedBy || author}
	<dl class="credits">
		{#if creditName}
			<dt>Credit</dt>
			<dd>
				{#if creditUrl}<a href={creditUrl} rel="noopener noreferrer nofollow" target="_blank">{creditName}</a
					>{:else}{creditName}{/if}
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

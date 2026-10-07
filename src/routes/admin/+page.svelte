<script lang="ts">
	import { enhance } from '$app/forms';
	import { plainText } from '#lib/links';
	import { thumbUrl } from '#lib/urls';

	let { data, form } = $props();
</script>

<svelte:head><title>Admin · dichoptic.art</title></svelte:head>

<main class="narrow">
	<h1>Admin</h1>

	{#if !data.admin}
		<form method="post" action="?/login" use:enhance class="panel">
			<div class="field">
				<label for="token">Admin token</label>
				<input id="token" name="token" type="password" autocomplete="off" required />
			</div>
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			<button class="primary">Sign in</button>
		</form>
	{:else}
		<form method="post" action="?/logout" use:enhance><button class="link small">Sign out</button></form>

		<div class="panel">
			<div class="row switch">
				<div>
					<strong>Submissions: {data.paused ? 'paused' : 'open'}</strong>
					<div class="muted small">
						{#if data.paused}
							Paused since {new Date(data.paused.since).toLocaleString()} ({data.paused.reason === 'admin' ? 'by an admin' : data.paused.reason}).
							Browsing, search and likes still work.
						{:else}
							Pausing stops uploads and new collections for everyone. Browsing, search and likes keep working.
						{/if}
					</div>
				</div>
				<form method="post" action={data.paused ? '?/resume' : '?/pause'} use:enhance>
					<button class={data.paused ? 'primary' : ''}>{data.paused ? 'Resume submissions' : 'Pause submissions'}</button>
				</form>
			</div>
			<div class="row switch">
				<div>
					<strong>Moderation: {data.moderation ? 'on' : 'off'}</strong>
					<div class="muted small">
						{#if data.moderation}
							New public images and collections wait in the queue below until approved.
						{:else}
							New submissions are published at once. Anything already pending stays pending until reviewed.
						{/if}
					</div>
				</div>
				<form method="post" action="?/moderation" use:enhance>
					<input type="hidden" name="on" value={String(!data.moderation)} />
					<button class={data.moderation ? '' : 'primary'}>{data.moderation ? 'Turn moderation off' : 'Turn moderation on'}</button>
				</form>
			</div>
		</div>

		<p class="muted small">
			Storage: {(data.storage.used / 1048576).toFixed(0)} MB of {(data.storage.limit / 1048576).toFixed(0)} MB
			({((data.storage.used / data.storage.limit) * 100).toFixed(0)}%). Uploads close at the limit.
		</p>

		<h2>Flagged</h2>
		{#each data.flagged as f (f.ip)}
			<div class="panel">
				<div class="row" style="justify-content: space-between">
					<span><code>{f.ip}</code> <span class="muted small">{f.last24h} submissions in 24 h</span></span>
					<form method="post" action="?/clearFlag" use:enhance>
						<input type="hidden" name="ip" value={f.ip} />
						<button>Dismiss</button>
					</form>
				</div>
				<ul class="recent small">
					{#each f.recent as s (s.type + s.id)}
						<li>
							<a href="/{s.type}/{s.id}">{s.title ?? `(untitled ${s.type})`}</a>
							<span class="muted">{s.type} · {new Date(s.at).toLocaleString()}</span>
						</li>
					{/each}
				</ul>
			</div>
		{:else}
			<p class="muted">No flagged clients.</p>
		{/each}

		<h2>Moderation queue</h2>

		{#each data.queue.collections as c (c.id)}
			<div class="panel">
				<h3>Collection: <a href="/collection/{c.id}">{c.title}</a></h3>
				<p class="muted small">{c.images.length} images · {c.submittedBy ?? (plainText(c.credit) || 'anonymous')}</p>
				<div class="thumbs">
					{#each c.images as i (i.id)}<img src={thumbUrl(i.thumbPrefix, 400)} alt={i.title ?? ''} />{/each}
				</div>
				{@render review('collection', c.id)}
			</div>
		{/each}
		{#each data.queue.images as i (i.id)}
			<div class="panel">
				<h3>Image: <a href="/image/{i.id}">{i.title ?? 'Untitled'}</a></h3>
				<p class="muted small">{i.submittedBy ?? (plainText(i.credit) || 'anonymous')}{i.collectionId ? ' · added to an approved collection' : ''}</p>
				<img class="big" src={thumbUrl(i.thumbPrefix, 800)} alt={i.title ?? ''} />
				{@render review('image', i.id)}
			</div>
		{/each}
		{#if !data.queue.collections.length && !data.queue.images.length}
			<p class="muted">Nothing waiting for review.</p>
		{/if}

		<h2>Private submissions</h2>
		<p class="muted small">Only their owners and admins can open these.</p>
		<ul class="recent small">
			{#each data.private.collections as c (c.id)}
				<li><a href="/collection/{c.id}">{c.title}</a> <span class="muted">collection</span></li>
			{/each}
			{#each data.private.images as i (i.id)}
				<li><a href="/image/{i.id}">{i.title ?? 'Untitled'}</a> <span class="muted">image</span></li>
			{/each}
			{#if !data.private.collections.length && !data.private.images.length}
				<li class="muted">None.</li>
			{/if}
		</ul>
	{/if}
</main>

{#snippet review(type: string, id: string)}
	<form method="post" use:enhance class="row">
		<input type="hidden" name="type" value={type} />
		<input type="hidden" name="id" value={id} />
		<input name="reason" placeholder="Reason (if rejecting)" style="flex: 1; min-width: 12em" />
		<button class="primary" formaction="?/approve">Approve</button>
		<button class="danger" formaction="?/reject">Reject</button>
	</form>
{/snippet}

<style>
	.switch {
		justify-content: space-between;
		align-items: center;
		padding: 0.4em 0;
	}
	.switch + .switch {
		border-top: 1px solid var(--border);
	}
	.recent {
		list-style: none;
		padding: 0;
		margin: 0.6em 0 0;
		display: grid;
		gap: 0.2em;
	}
	.thumbs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.4em;
		margin-bottom: 0.8em;
	}
	.thumbs img,
	.big {
		width: 100%;
		display: block;
		background: #000;
		border-radius: 4px;
	}
	.big {
		margin-bottom: 0.8em;
	}
</style>

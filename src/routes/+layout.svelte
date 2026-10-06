<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import logo from '#lib/assets/logo.svg';
	import { consent, initConsent, needsPrompt, setConsent } from '#lib/consent.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(initConsent);

	const links = [
		{ href: '/', label: 'Browse' },
		{ href: '/upload', label: 'Upload' },
		{ href: '/me', label: 'My submissions' }
	];
	const here = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>dichoptic.art</title>
</svelte:head>

<header>
	<a class="brand" href="/"><img src={logo} alt="" />dichoptic<span>.art</span></a>
	<nav>
		{#each links as l (l.href)}
			<a href={l.href} class:current={here(l.href)}>{l.label}</a>
		{/each}
	</nav>
</header>

{@render children()}

{#if needsPrompt()}
	<div class="consent" role="dialog" aria-label="Cookie notice">
		{#if consent.choice === 'denied'}
			<p>
				You turned cookies off, so likes are disabled and uploads from this browser can't be edited
				or deleted later. Accept to turn them on; it is the only thing the cookies are used for.
			</p>
		{:else}
			<p>
				This site uses cookies only to remember your likes and to let you edit or delete your own
				submissions. Nothing else about you is stored.
			</p>
		{/if}
		<div class="row choices">
			<button class="primary" onclick={() => setConsent('accepted')}>Accept</button>
			<button class="primary" onclick={() => setConsent('denied')}>Deny</button>
		</div>
	</div>
{/if}

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		flex-wrap: wrap;
		padding: 0.8em var(--gutter);
		border-bottom: 1px solid var(--border);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5em;
		font-weight: 700;
		font-size: 1.15rem;
		color: var(--text);
		letter-spacing: 0.01em;
	}
	.brand img {
		height: 1.5em;
		width: auto;
	}
	.brand span {
		color: var(--muted);
		font-weight: 400;
	}
	nav {
		display: flex;
		gap: 1.2em;
		flex-wrap: wrap;
	}
	nav a {
		color: var(--muted);
	}
	nav a.current,
	nav a:hover {
		color: var(--text);
		text-decoration: none;
	}
	.consent {
		position: fixed;
		z-index: 50;
		left: 50%;
		bottom: 1em;
		transform: translateX(-50%);
		width: min(560px, calc(100% - 24px));
		background: var(--surface-2);
		border: 1px solid #444;
		border-radius: var(--radius);
		padding: 1em;
		box-shadow: 0 8px 30px #000a;
	}
	.consent p {
		margin: 0 0 0.8em;
	}
	.choices {
		justify-content: center;
	}
	.consent button {
		min-width: 6em;
		justify-content: center;
	}
</style>

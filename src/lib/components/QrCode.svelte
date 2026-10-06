<script lang="ts">
	import QRCode from 'qrcode';

	let { value, size = 132 }: { value: string; size?: number } = $props();
	let svg = $state('');

	$effect(() => {
		let current = true;
		QRCode.toString(value, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }).then((s) => {
			if (current) svg = s;
		});
		return () => (current = false);
	});
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- generated locally from the link, not user markup -->
<div class="qr" style="width: {size}px; height: {size}px" role="img" aria-label="QR code of the recovery link">{@html svg}</div>

<style>
	.qr {
		background: #fff;
		border-radius: 6px;
		overflow: hidden;
		flex: none;
	}
	.qr :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>

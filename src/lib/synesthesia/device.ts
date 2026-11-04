// A short name for the device a session ran on ("iPhone · Safari"), from its user agent, so admin
// pages and the export say on which device each answer was given. The full device info stays in
// the session.
export function deviceLabel(device: unknown): string {
	const ua = (device as { userAgent?: string } | null)?.userAgent ?? '';
	if (!ua) return 'unknown';
	const kind = /iPhone/.test(ua)
		? 'iPhone'
		: /iPad/.test(ua)
			? 'iPad'
			: /Android/.test(ua)
				? /Mobile/.test(ua) ? 'Android phone' : 'Android tablet'
				: /Macintosh/.test(ua)
					? // iPads ask for the desktop site and say "Macintosh"; touch points tell them apart.
						(device as { touchPoints?: number }).touchPoints! > 1 ? 'iPad' : 'Mac'
					: /Windows/.test(ua)
						? 'Windows'
						: /Linux/.test(ua)
							? 'Linux'
							: 'other';
	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /OPR\/|Opera/.test(ua)
			? 'Opera'
			: /Firefox\/|FxiOS/.test(ua)
				? 'Firefox'
				: /Chrome\/|CriOS/.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: 'browser';
	return `${kind} · ${browser}`;
}

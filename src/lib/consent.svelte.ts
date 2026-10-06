type Choice = 'accepted' | 'denied';

const KEY = 'consent';

function read(): Choice | null {
	try {
		const v = localStorage.getItem(KEY);
		return v === 'accepted' || v === 'denied' ? v : null;
	} catch {
		return null;
	}
}

// The choice lives in localStorage only; it never reaches the server except as a request header.
export const consent = $state<{ choice: Choice | null; open: boolean; ready: boolean }>({
	choice: null,
	open: false,
	ready: false
});

// Called from the layout on mount, so server and first client render agree.
export function initConsent() {
	consent.choice = read();
	consent.ready = true;
}

export function setConsent(choice: Choice) {
	consent.choice = choice;
	consent.open = false;
	try {
		localStorage.setItem(KEY, choice);
	} catch {
		// private mode: the choice just lasts for this page view
	}
}

export const needsPrompt = () => consent.ready && (consent.choice === null || consent.open);

// Opens the banner again, e.g. when a like is clicked after denying.
export const askConsent = () => {
	consent.open = true;
};

export interface ApiResult<T = Record<string, unknown>> {
	ok: boolean;
	status: number;
	data: T & { error?: string; errors?: Record<string, string> };
}

export async function api<T = Record<string, unknown>>(
	path: string,
	init: { method?: string; json?: unknown } = {}
): Promise<ApiResult<T>> {
	const res = await fetch(path, {
		method: init.method ?? (init.json ? 'POST' : 'GET'),
		headers: {
			...(init.json ? { 'content-type': 'application/json' } : {}),
			...(consent.choice === 'accepted' ? { 'x-consent': 'accepted' } : {})
		},
		body: init.json ? JSON.stringify(init.json) : undefined
	});
	const data = await res.json().catch(() => ({ error: 'Unexpected server response' }));
	return { ok: res.ok, status: res.status, data };
}

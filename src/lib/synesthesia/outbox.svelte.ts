import { checklistAnswers } from './checklist';
import type { Colour } from './okhsl';

// Answers are written to the device first and sent in order, retried until the server has
// them, so a weak connection never loses or reorders anything. Timecodes are taken when she
// acts, never when the answer reaches the server.

export interface Answer {
	clientId: string;
	attemptId: string;
	kind: 'colour' | 'none' | 'note' | 'flag' | 'retract';
	start: number | null;
	end: number | null;
	colour: Colour | null;
	note: string | null;
	supersedes: string | null;
	answeredAt: string;
	tz: string | null;
	shownMs: number | null;
	sincePrevMs: number | null;
}

// Reverse test: the colour shown and what she wrote (or "nothing").
export interface ReverseAnswer {
	clientId: string;
	colour: Colour;
	text: string | null;
	nothing: boolean;
	answeredAt: string;
	tz: string | null;
	shownMs: number | null;
}

type Item = (Answer & { type?: undefined }) | (ReverseAnswer & { type: 'reverse' });

const KEY = 'syn-outbox';

// A random id. crypto.randomUUID() exists only on https and localhost, and the page is also
// opened over plain http on the local network (testing on a phone); getRandomValues works on both.
export const uid = () =>
	Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

export const outbox = $state({ pending: 0, failing: false });

let items: Item[] = [];
let flushing = false;
let delay = 1000;
let started = false;

function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(items));
	} catch {
		// storage unavailable: the in-memory queue still works for this visit
	}
	outbox.pending = items.length;
}

function start() {
	if (started) return;
	started = true;
	try {
		items = JSON.parse(localStorage.getItem(KEY) ?? '[]');
	} catch {
		items = [];
	}
	outbox.pending = items.length;
	addEventListener('online', () => void flush());
	void flush();
}

// One id per tab and page load: a "session".
function session() {
	let id: string | null = null;
	try {
		id = sessionStorage.getItem('syn-session');
		if (!id) sessionStorage.setItem('syn-session', (id = uid()));
	} catch {
		id ??= uid();
	}
	return {
		id,
		device: {
			userAgent: navigator.userAgent,
			screen: [screen.width, screen.height],
			viewport: [innerWidth, innerHeight],
			pixelRatio: devicePixelRatio,
			gamut: matchMedia('(color-gamut: p3)').matches ? 'p3' : 'srgb',
			timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			checklist: checklistAnswers()
		}
	};
}

function queue(item: Item) {
	start();
	items.push(item);
	save();
	void flush();
}

export const send = (answer: Answer) => queue(answer);
export const sendReverse = (answer: ReverseAnswer) => queue({ ...answer, type: 'reverse' });

export function startOutbox() {
	start();
}

async function flush() {
	if (flushing || !items.length) return;
	flushing = true;
	const batch = items.slice(0, 50);
	try {
		const res = await fetch('/synesthesia/api/answers', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				session: session(),
				answers: batch.filter((i) => i.type !== 'reverse'),
				reverse: batch.filter((i) => i.type === 'reverse')
			})
		});
		if (!res.ok) throw new Error(String(res.status));
		const sent = new Set(batch.map((b) => b.clientId));
		items = items.filter((i) => !sent.has(i.clientId));
		save();
		outbox.failing = false;
		delay = 1000;
	} catch {
		outbox.failing = true;
		setTimeout(() => void flush(), delay);
		delay = Math.min(delay * 2, 30000);
		return;
	} finally {
		flushing = false;
	}
	if (items.length) void flush();
}

// Answers for an attempt that are still waiting to be sent (so a reload shows them as done).
export function pendingFor(attemptId: string) {
	start();
	return items.filter((i): i is Answer => i.type !== 'reverse' && i.attemptId === attemptId);
}

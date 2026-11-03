// Screen settings that change the colours she sees, asked once per visit. Her ticks are stored
// with the session (see the outbox), so analysis knows which answers came from a tinted screen.

export const CHECKLIST = [
	{ id: 'nightLight', label: 'Night Shift, Night Light, Eye Comfort or any blue-light filter is off' },
	{ id: 'adaptiveColour', label: 'True Tone or adaptive colour is off, and the screen colour mode is standard or natural' },
	{ id: 'filters', label: 'Colour filters, colour inversion and reading or grayscale modes are off' },
	{ id: 'brightness', label: 'Auto-brightness is off, and brightness is steady and comfortable' }
] as const;

const KEY = 'syn-checklist';

export function checklistDone() {
	try {
		return sessionStorage.getItem(KEY) !== null;
	} catch {
		return false;
	}
}

export function saveChecklist(ticks: Record<string, boolean>) {
	const answers = Object.fromEntries(CHECKLIST.map((c) => [c.id, !!ticks[c.id]]));
	try {
		sessionStorage.setItem(KEY, JSON.stringify(answers));
	} catch {
		// private mode: the answers are only lost for this visit
	}
}

export function checklistAnswers(): Record<string, boolean> | null {
	try {
		return JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
	} catch {
		return null;
	}
}

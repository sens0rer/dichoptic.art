// Selecting words and pasting a web address turns them into [word](address), like most editors do.
const ADDRESS = /^(https?:\/\/)?[^\s/()[\]]+\.[^\s()[\]]+$/i;

export function linkOnPaste(e: ClipboardEvent, set: (value: string) => void) {
	const field = e.currentTarget as HTMLInputElement | HTMLTextAreaElement;
	const { selectionStart: a, selectionEnd: b } = field;
	const pasted = e.clipboardData?.getData('text').trim() ?? '';
	if (a === null || b === null || a === b || !ADDRESS.test(pasted)) return;
	e.preventDefault();
	const link = `[${field.value.slice(a, b)}](${pasted})`;
	set(field.value.slice(0, a) + link + field.value.slice(b));
	const end = a + link.length;
	queueMicrotask(() => field.setSelectionRange(end, end));
}

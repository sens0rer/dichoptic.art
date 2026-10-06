import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { PausedError } from './abuse';
import { fieldErrors } from './meta';
import { UploadError } from './process';

export const fail = (status: number, error: string, extra: object = {}) =>
	json({ error, ...extra }, { status });

export async function body(event: RequestEvent): Promise<unknown> {
	if (!event.request.headers.get('content-type')?.includes('application/json')) return null;
	try {
		return await event.request.json();
	} catch {
		return null;
	}
}

export function zodFail(error: z.ZodError, prefix = '') {
	const errors = fieldErrors(error);
	return fail(400, 'Please fix the highlighted fields.', {
		errors: prefix ? Object.fromEntries(Object.entries(errors).map(([k, v]) => [prefix + k, v])) : errors
	});
}

// Maps domain errors thrown inside an endpoint to JSON responses.
export async function guard(run: () => Promise<Response>): Promise<Response> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof PausedError) return fail(503, e.message, { paused: true });
		if (e instanceof UploadError) return fail(400, e.message);
		throw e;
	}
}

export const clientIp = (event: RequestEvent) => event.getClientAddress();

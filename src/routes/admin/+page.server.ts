import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { isAdmin, login, logout } from '#lib/server/admin';
import { clearFlag, flaggedClients, pausedInfo, resume } from '#lib/server/abuse';
import { config } from '#lib/server/config';
import { storageUsed } from '#lib/server/quota';
import { pendingQueue, privateSubmissions } from '#lib/server/content';
import { db } from '#lib/server/db';
import {
	approveCollection,
	approveImage,
	rejectCollection,
	rejectImage
} from '#lib/server/submissions';

export async function load({ cookies }) {
	if (!isAdmin(cookies)) return { admin: false as const };
	return {
		admin: true as const,
		moderation: config.moderation,
		paused: await pausedInfo(),
		flagged: await flaggedClients(),
		storage: { used: await storageUsed(), limit: config.storageLimitBytes },
		queue: await pendingQueue(),
		private: await privateSubmissions()
	};
}

const reviewSchema = z.object({
	type: z.enum(['image', 'collection']),
	id: z.string(),
	reason: z.string().trim().max(500).optional()
});

export const actions = {
	login: async ({ request, cookies }) => {
		const token = String((await request.formData()).get('token') ?? '');
		return login(cookies, token) ? { ok: true } : fail(403, { error: 'Wrong token' });
	},
	logout: async ({ cookies }) => {
		logout(cookies);
	},
	approve: async ({ request, cookies }) => {
		if (!isAdmin(cookies)) return fail(403);
		const p = reviewSchema.parse(Object.fromEntries(await request.formData()));
		await db.transaction(async (tx) => {
			if (p.type === 'collection') await approveCollection(tx, p.id);
			else await approveImage(tx, p.id);
		});
	},
	reject: async ({ request, cookies }) => {
		if (!isAdmin(cookies)) return fail(403);
		const p = reviewSchema.parse(Object.fromEntries(await request.formData()));
		await db.transaction(async (tx) => {
			if (p.type === 'collection') await rejectCollection(tx, p.id, p.reason || null);
			else await rejectImage(tx, p.id, p.reason || null);
		});
	},
	resume: async ({ cookies }) => {
		if (!isAdmin(cookies)) return fail(403);
		await resume();
	},
	clearFlag: async ({ request, cookies }) => {
		if (!isAdmin(cookies)) return fail(403);
		await clearFlag(String((await request.formData()).get('ip') ?? ''));
	}
};

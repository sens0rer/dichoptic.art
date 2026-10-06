import { defineEnvVars } from '@sveltejs/kit/env';

const required = (name: string) => (value: string | undefined) => {
	if (!value) throw new Error(`${name} must be set`);
	return value;
};
const optional = (fallback: string) => (value: string | undefined) => value || fallback;
const integer = (name: string, fallback: number) => (value: string | undefined) => {
	if (!value) return fallback;
	const n = Number(value);
	if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`);
	return n;
};

export const variables = defineEnvVars({
	DATABASE_URL: { schema: required('DATABASE_URL') },
	// Signs local upload URLs and the admin cookie.
	SECRET: { schema: required('SECRET') },
	// Always required: /admin is the only way to resume paused submissions.
	ADMIN_TOKEN: { schema: required('ADMIN_TOKEN') },
	PUBLIC_URL: { schema: optional('http://localhost:5173') },
	MODERATION: {
		schema: (value) => {
			if (value !== undefined && value !== 'on' && value !== 'off')
				throw new Error('MODERATION must be "on" or "off"');
			return value === 'on';
		}
	},
	FLAG_THRESHOLD: { schema: integer('FLAG_THRESHOLD', 30) },
	PAUSE_THRESHOLD: { schema: integer('PAUSE_THRESHOLD', 100) },
	SITE_PAUSE_THRESHOLD: { schema: integer('SITE_PAUSE_THRESHOLD', 300) },
	UPLOAD_DIR: { schema: optional('data/uploads') },
	// 'r2' stores files in Cloudflare R2; the R2_* variables below are then required.
	STORAGE: {
		schema: (value) => {
			if (value !== undefined && value !== 'local' && value !== 'r2')
				throw new Error('STORAGE must be "local" or "r2"');
			return value ?? 'local';
		}
	},
	R2_ACCOUNT_ID: { schema: (v) => v ?? '' },
	R2_ACCESS_KEY_ID: { schema: (v) => v ?? '' },
	R2_SECRET_ACCESS_KEY: { schema: (v) => v ?? '' },
	R2_BUCKET: { schema: (v) => v ?? '' },
	// Where the browser loads image files from: '/files' (served by this app, with visibility checks)
	// or the bucket's public URL, e.g. https://img.example.com.
	FILES_BASE: { public: true, schema: (v) => (v || '/files').replace(/\/$/, '') }
});

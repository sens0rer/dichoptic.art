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
	UPLOAD_DIR: { schema: optional('data/uploads') }
});

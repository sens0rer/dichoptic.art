import * as env from '$app/env/private';

export const config = {
	get databaseUrl() {
		return env.DATABASE_URL;
	},
	get publicUrl() {
		return env.PUBLIC_URL.replace(/\/$/, '');
	},
	get secret() {
		return env.SECRET;
	},
	get adminToken() {
		return env.ADMIN_TOKEN;
	},
	get moderation() {
		return env.MODERATION;
	},
	get flagThreshold() {
		return env.FLAG_THRESHOLD;
	},
	get pauseThreshold() {
		return env.PAUSE_THRESHOLD;
	},
	get sitePauseThreshold() {
		return env.SITE_PAUSE_THRESHOLD;
	},
	get storageLimitBytes() {
		return env.STORAGE_LIMIT_MB * 1024 * 1024;
	},
	get uploadBytesPerIpDay() {
		return env.UPLOAD_MB_PER_IP_DAY * 1024 * 1024;
	},
	get uploadBytesSiteDay() {
		return env.UPLOAD_MB_SITE_DAY * 1024 * 1024;
	},
	get storage() {
		return env.STORAGE;
	},
	get r2() {
		if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET)
			throw new Error('STORAGE=r2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET');
		return {
			accountId: env.R2_ACCOUNT_ID,
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
			bucket: env.R2_BUCKET
		};
	},
	get uploadDir() {
		return env.UPLOAD_DIR;
	}
};

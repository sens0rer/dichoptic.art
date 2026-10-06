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
	get uploadDir() {
		return env.UPLOAD_DIR;
	}
};

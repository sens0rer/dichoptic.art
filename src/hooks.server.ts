import { config } from '#lib/server/config';
import { sweepTmp } from '#lib/server/storage';

// Fail at start-up, not on the first request, when required configuration is missing.
export const init = async () => {
	void [config.databaseUrl, config.secret, config.adminToken];
	await sweepTmp();
};

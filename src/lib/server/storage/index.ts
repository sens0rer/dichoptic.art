import { config } from '../config';
import { localStorageImpl, sweepTmp as sweepLocalTmp } from './local';
import { r2Storage } from './r2';
import type { Storage } from './types';

const pick = (): Storage => (config.storage === 'r2' ? r2Storage : localStorageImpl);

// Chosen per call so importing this module needs no environment (e.g. during build).
export const storage: Storage = {
	presignUpload: (key, opts) => pick().presignUpload(key, opts),
	put: (key, data, type) => pick().put(key, data, type),
	get: (key) => pick().get(key),
	move: (from, to) => pick().move(from, to),
	delete: (key) => pick().delete(key)
};

// R2 expires tmp/ files with a bucket lifecycle rule instead.
export const sweepTmp = () => (config.storage === 'local' ? sweepLocalTmp() : Promise.resolve());
export type { Storage };

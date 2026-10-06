import { localStorageImpl } from './local';
import type { Storage } from './types';

// Swap in the R2 implementation here when hosting.
export const storage: Storage = localStorageImpl;
export { sweepTmp } from './local';
export type { Storage };

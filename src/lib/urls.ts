import { THUMB_WIDTHS } from './vocab';

// All public file URLs come from here; hosted storage changes only this function.
export const fileUrl = (key: string) => `/files/${key}`;

export const thumbUrl = (prefix: string, width: (typeof THUMB_WIDTHS)[number]) =>
	fileUrl(`${prefix}-${width}.webp`);

export const thumbSrcset = (prefix: string) =>
	THUMB_WIDTHS.map((w) => `${thumbUrl(prefix, w)} ${w}w`).join(', ');

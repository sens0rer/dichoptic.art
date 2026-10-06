import { FILES_BASE } from '$app/env/public';
import { THUMB_WIDTHS } from './vocab';

// All public file URLs come from here; hosted storage changes only this function.
export const fileUrl = (key: string) => `${FILES_BASE}/${key}`;

// Link-preview tags need absolute URLs.
export const absoluteUrl = (url: string, publicUrl: string) =>
	url.startsWith('http') ? url : publicUrl + url;

export const thumbUrl = (prefix: string, width: (typeof THUMB_WIDTHS)[number]) =>
	fileUrl(`${prefix}-${width}.webp`);

export const thumbSrcset = (prefix: string) =>
	THUMB_WIDTHS.map((w) => `${thumbUrl(prefix, w)} ${w}w`).join(', ');

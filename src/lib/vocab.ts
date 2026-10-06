// Fixed vocabularies shared by the schema, validation and the UI.
export const DIMENSIONS = ['2D', '3D'] as const;
export const MEDIUMS = ['photography', 'art', 'digital_art'] as const;
export const ALTERATIONS = ['unaltered', 'digitally_altered'] as const;
export const CHROMACIES = ['none', 'di', 'tri', 'tetra', 'penta', 'hexa'] as const;
export const SOURCE_MODES = ['two_files', 'single_file'] as const;
export const STATUSES = ['pending', 'approved', 'rejected'] as const;

export const LABELS: Record<string, string> = {
	'2D': '2D',
	'3D': '3D',
	photography: 'Photography',
	art: 'Art',
	digital_art: 'Digital art',
	unaltered: 'Unaltered',
	digitally_altered: 'Digitally altered',
	none: 'None (same colors)',
	di: 'Dichromacy',
	tri: 'Trichromacy',
	tetra: 'Tetrachromacy',
	penta: 'Pentachromacy',
	hexa: 'Hexachromacy'
};

export const FILTER_CATEGORIES = [
	{ key: 'dimension', label: 'Dimension', values: DIMENSIONS },
	{ key: 'medium', label: 'Medium', values: MEDIUMS },
	{ key: 'alteration', label: 'Alteration', values: ALTERATIONS },
	{ key: 'chromacy', label: 'Chromacy', values: CHROMACIES }
] as const;

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const THUMB_WIDTHS = [400, 800, 1600] as const;

export type Dimension = (typeof DIMENSIONS)[number];
export type Medium = (typeof MEDIUMS)[number];
export type Alteration = (typeof ALTERATIONS)[number];
export type Chromacy = (typeof CHROMACIES)[number];
export type SourceMode = (typeof SOURCE_MODES)[number];
export type Status = (typeof STATUSES)[number];

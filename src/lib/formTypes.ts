export interface Meta {
	title: string;
	description: string;
	credit: string;
	submittedBy: string;
	author: string;
	dimension: string;
	medium: string;
	alteration: string;
	chromacy: string;
	chromacyType: string;
	filterInfo: string;
	date: string;
	tags: string[];
	private: boolean;
}

// The visitor's own calendar day, as YYYY-MM-DD.
export const todayLocal = () => new Date().toLocaleDateString('en-CA');

// `date` defaults to today; per-pair forms inside a collection pass '' to inherit the collection's.
export const emptyMeta = (date = todayLocal()): Meta => ({
	title: '',
	description: '',
	credit: '',
	submittedBy: '',
	author: '',
	dimension: '',
	medium: '',
	alteration: '',
	chromacy: '',
	chromacyType: '',
	filterInfo: '',
	date,
	tags: [],
	private: false
});

export interface Preset {
	code: string;
	name: string;
	chromacy: string;
}

export interface PairRef {
	mode: 'single_file' | 'two_files';
	left: string;
	right?: string;
}

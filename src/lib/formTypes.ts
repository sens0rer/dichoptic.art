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
	tags: string[];
	private: boolean;
}

export const emptyMeta = (): Meta => ({
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

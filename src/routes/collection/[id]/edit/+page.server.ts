import { error } from '@sveltejs/kit';
import { chromacyPresets, getCollection } from '#lib/server/content';
import { currentOwner } from '#lib/server/owner';

export async function load({ params, cookies }) {
	const owner = await currentOwner(cookies);
	const data = await getCollection(params.id, owner?.id);
	if (!data?.isOwner) error(404, 'Collection not found');
	const { collection: c } = data;
	return {
		collection: {
			id: c.id,
			title: c.title,
			description: c.description ?? '',
			credit: c.credit ?? '',
			submittedBy: c.submittedBy ?? '',
			author: c.author ?? '',
			dimension: c.dimension ?? '',
			medium: c.medium ?? '',
			alteration: c.alteration ?? '',
			chromacy: c.chromacy ?? '',
			chromacyType: c.chromacyType ?? '',
			filterInfo: c.filterInfo ?? '',
			date: c.date ?? '',
			private: c.private,
			tags: data.tags,
			coverImageId: c.coverImageId
		},
		images: data.images.map((i) => ({
			id: i.id,
			title: i.title,
			thumbPrefix: i.thumbPrefix
		})),
		presets: await chromacyPresets()
	};
}

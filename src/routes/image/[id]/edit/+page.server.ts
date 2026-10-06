import { error } from '@sveltejs/kit';
import { chromacyPresets, getImage } from '#lib/server/content';
import { currentOwner } from '#lib/server/owner';

export async function load({ params, cookies }) {
	const owner = await currentOwner(cookies);
	const data = await getImage(params.id, owner?.id);
	if (!data?.isOwner) error(404, 'Image not found');
	const { image, collection } = data;
	return {
		image: {
			id: image.id,
			title: image.title ?? '',
			description: image.description ?? '',
			credit: image.credit ?? '',
			submittedBy: image.submittedBy ?? '',
			author: image.author ?? '',
			dimension: image.dimension ?? '',
			medium: image.medium ?? '',
			alteration: image.alteration ?? '',
			chromacy: image.chromacy ?? '',
			chromacyType: image.chromacyType ?? '',
			filterInfo: image.filterInfo ?? '',
			date: image.date ?? '',
			private: image.private,
			tags: data.ownTags,
			sourceMode: image.sourceMode,
			thumbPrefix: image.thumbPrefix
		},
		master: collection
			? {
					id: collection.id,
					title: collection.title,
					medium: collection.medium
				}
			: null,
		presets: await chromacyPresets()
	};
}

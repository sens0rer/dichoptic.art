import { error } from '@sveltejs/kit';
import { config } from '#lib/server/config';
import { getCollection } from '#lib/server/content';
import { currentOwner } from '#lib/server/owner';

export async function load({ params, cookies }) {
	const owner = await currentOwner(cookies);
	const data = await getCollection(params.id, owner?.id);
	if (!data) error(404, 'Collection not found');
	const { collection } = data;
	const cover =
		data.images.find((i) => i.id === collection.coverImageId && i.status === 'approved') ??
		data.images.find((i) => i.status === 'approved') ??
		data.images[0];
	return {
		collection: {
			id: collection.id,
			title: collection.title,
			description: collection.description,
			creditName: collection.creditName,
			creditUrl: collection.creditUrl,
			submittedBy: collection.submittedBy,
			author: collection.author,
			dimension: collection.dimension,
			medium: collection.medium,
			alteration: collection.alteration,
			chromacy: collection.chromacy,
			chromacyType: collection.chromacyType,
			filterInfo: collection.filterInfo,
			likeCount: collection.likeCount,
			status: collection.status,
			rejectReason: collection.rejectReason
		},
		cover: cover ? { thumbPrefix: cover.thumbPrefix } : null,
		images: data.images.map((i) => ({
			id: i.id,
			title: i.title,
			thumbPrefix: i.thumbPrefix,
			thumbW: i.thumbW,
			thumbH: i.thumbH,
			status: i.status,
			likeCount: i.likeCount
		})),
		tags: data.tags,
		isOwner: data.isOwner,
		live: data.live,
		liked: data.liked,
		publicUrl: config.publicUrl
	};
}

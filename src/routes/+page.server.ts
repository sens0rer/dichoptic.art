import { config } from '#lib/server/config';
import { listEntries } from '#lib/server/feed';
import { feedPage } from '#lib/server/feedPage';
import { parseQuery } from '#lib/query';
import { absoluteUrl, thumbUrl } from '#lib/urls';

export async function load({ url }) {
	const { filters, sort } = parseQuery(url.searchParams);
	// The link preview shows the newest public pair, whatever filters this visit has.
	const [latest] = await listEntries(parseQuery(new URLSearchParams()).filters, 'new', { limit: 1 });
	const preview = latest
		? {
				image: absoluteUrl(thumbUrl(latest.thumbPrefix, 1600), config.publicUrl),
				width: latest.thumbW,
				height: latest.thumbH
			}
		: { image: `${config.publicUrl}/og.png`, width: 1200, height: 630 };
	return { ...(await feedPage(filters, sort)), publicUrl: config.publicUrl, preview };
}

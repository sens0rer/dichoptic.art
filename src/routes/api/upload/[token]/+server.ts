import { json } from '@sveltejs/kit';
import { fail } from '#lib/server/api';
import { storage } from '#lib/server/storage';
import { verifyUploadToken } from '#lib/server/storage/local';

// Local stand-in for a presigned R2 URL: the signature fixes the key, type and size limit.
export async function PUT({ params, request }) {
	const grant = verifyUploadToken(params.token);
	if (!grant) return fail(403, 'Upload link is invalid or expired');
	if (request.headers.get('content-type') !== grant.contentType)
		return fail(400, 'Wrong file type');
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > grant.maxBytes) return fail(413, 'Files can be at most 20 MB');

	const chunks: Uint8Array[] = [];
	let total = 0;
	for await (const chunk of request.body ?? []) {
		total += chunk.byteLength;
		if (total > grant.maxBytes) return fail(413, 'Files can be at most 20 MB');
		chunks.push(chunk);
	}
	await storage.put(grant.key, Buffer.concat(chunks), grant.contentType);
	return json({ ok: true });
}

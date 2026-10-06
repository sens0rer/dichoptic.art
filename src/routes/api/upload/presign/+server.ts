import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { assertNotPaused } from '#lib/server/abuse';
import { body, fail, guard } from '#lib/server/api';
import { newFileId } from '#lib/server/ids';
import { storage } from '#lib/server/storage';
import { ACCEPTED_TYPES, MAX_FILE_BYTES } from '#lib/vocab';

const schema = z.object({
	files: z
		.array(
			z.object({
				type: z.enum(ACCEPTED_TYPES, 'Only JPEG, PNG and WebP are accepted'),
				size: z.number().int().min(1, 'The file is empty').max(MAX_FILE_BYTES, 'Files can be at most 20 MB')
			})
		)
		.min(1)
		.max(2)
});

export const POST = (event) =>
	guard(async () => {
		await assertNotPaused();
		const parsed = schema.safeParse(await body(event));
		if (!parsed.success) return fail(400, parsed.error.issues[0].message);
		const uploads = await Promise.all(
			parsed.data.files.map(async (f) => {
				const id = newFileId();
				return {
					id,
					...(await storage.presignUpload(`tmp/${id}`, {
						contentType: f.type,
						size: f.size
					}))
				};
			})
		);
		return json({ uploads });
	});

import { z } from 'zod';
import { SOURCE_MODES } from '../vocab';

export const pairSchema = z
	.object({
		mode: z.enum(SOURCE_MODES),
		left: z.string(),
		right: z.string().optional()
	})
	.refine((p) => p.mode === 'single_file' || !!p.right, 'Both images are required');

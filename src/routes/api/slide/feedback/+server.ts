import { z } from 'zod';

import { buildFeedbackPromptEnhancement, sanitizeFeedbackComment } from '$lib/server/slide';
import { apiError, slideFeedbackResultSchema, withApiHandler } from '$lib/server/validation';

const feedbackRequestSchema = z
	.object({
		documentId: z.string().trim().min(1),
		selectedTocItemId: z.string().trim().min(1),
		liked: z.boolean(),
		reason: z.enum(['STYLE_MISMATCH', 'CONTENT_MISMATCH', 'HTML_BROKEN']).optional(),
		comment: z.string().trim().max(2000).optional()
	})
	.superRefine((value, ctx) => {
		if (!value.liked && !value.reason) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['reason'],
				message: 'reason is required when liked=false'
			});
		}
	});

const feedbackStore: Array<{
	feedbackId: string;
	documentId: string;
	selectedTocItemId: string;
	liked: boolean;
	reason?: 'STYLE_MISMATCH' | 'CONTENT_MISMATCH' | 'HTML_BROKEN';
	comment?: string;
	createdAt: string;
}> = [];

export const POST = withApiHandler(async ({ request }) => {
	const rawBody = await request.json();
	const input = feedbackRequestSchema.parse(rawBody);
	const sanitizedComment = sanitizeFeedbackComment(input.comment);

	if (!input.liked && !input.reason) {
		throw apiError({
			code: 'VALIDATION_ERROR',
			status: 400,
			message: 'A dislike reason is required'
		});
	}

	const feedbackId = crypto.randomUUID();
	feedbackStore.push({
		feedbackId,
		documentId: input.documentId,
		selectedTocItemId: input.selectedTocItemId,
		liked: input.liked,
		reason: input.reason,
		comment: sanitizedComment || undefined,
		createdAt: new Date().toISOString()
	});

	const regeneration = buildFeedbackPromptEnhancement({
		liked: input.liked,
		reason: input.reason,
		comment: sanitizedComment
	});

	return slideFeedbackResultSchema.parse({
		feedbackId,
		documentId: input.documentId,
		selectedTocItemId: input.selectedTocItemId,
		liked: input.liked,
		reason: input.reason,
		regeneration
	});
});

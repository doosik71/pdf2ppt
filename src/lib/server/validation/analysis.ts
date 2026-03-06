import { z } from 'zod';

export const parsedPageSchema = z.object({
	page: z.number().int().positive(),
	text: z.string(),
	start: z.number().int().nonnegative(),
	end: z.number().int().nonnegative()
});

export const parsePdfResultSchema = z.object({
	documentId: z.string().trim().min(1),
	fullText: z.string().trim().min(1),
	pageMap: z.array(parsedPageSchema),
	metadata: z.object({
		filename: z.string().trim().min(1),
		size: z.number().int().nonnegative(),
		mimeType: z.string().trim().min(1),
		totalPages: z.number().int().positive()
	})
});

export const summaryResultSchema = z.object({
	documentId: z.string().trim().min(1),
	summary: z.string().trim().min(1),
	keyPoints: z.array(z.string().trim().min(1)).min(1),
	meta: z.object({
		chunked: z.boolean(),
		chunkCount: z.number().int().positive(),
		truncated: z.boolean().optional()
	})
});

export const tocItemSchema = z.object({
	id: z.string().trim().min(1),
	title: z.string().trim().min(1),
	order: z.number().int().positive(),
	sourceSpan: z
		.object({
			start: z.number().int().nonnegative(),
			end: z.number().int().nonnegative()
		})
		.optional()
});

export const tocResultSchema = z.object({
	documentId: z.string().trim().min(1),
	tocItems: z.array(tocItemSchema).min(1),
	meta: z.object({
		chunked: z.boolean(),
		chunkCount: z.number().int().positive(),
		truncated: z.boolean().optional()
	})
});

export const slideGenerateResultSchema = z.object({
	documentId: z.string().trim().min(1),
	selectedTocItemId: z.string().trim().min(1),
	themeId: z.string().trim().min(1),
	slideHtml: z.string().trim().min(1),
	slideCss: z.string().trim().min(1),
	renderedHtml: z.string().trim().min(1),
	rationale: z.string().trim().optional(),
	usedContextVersion: z.number().int().nonnegative().optional(),
	retry: z
		.object({
			attempt: z.number().int().positive(),
			maxAttempts: z.number().int().positive(),
			delaysUsedMs: z.array(z.number().int().nonnegative())
	})
		.optional()
});

export const slideFeedbackResultSchema = z.object({
	feedbackId: z.string().trim().min(1),
	documentId: z.string().trim().min(1),
	selectedTocItemId: z.string().trim().min(1),
	liked: z.boolean(),
	reason: z.enum(['STYLE_MISMATCH', 'CONTENT_MISMATCH', 'HTML_BROKEN']).optional(),
	regeneration: z.object({
		goalPromptPatch: z.string(),
		themePromptPatch: z.string(),
		shouldResetContext: z.boolean()
	})
});

import { z } from 'zod';

import { getDefaultLlmProvider } from '$lib/server/llm';
import { renderSlideTemplate, validateGeneratedSlide } from '$lib/server/slide';
import { getThemeTemplate, type ThemeTemplateId } from '$lib/templates/themes';
import { apiError, slideGenerateResultSchema, tocItemSchema, withApiHandler } from '$lib/server/validation';

const themeIdSchema = z.enum(['classic-blue', 'forest-green', 'sunset-orange', 'mono-gray']);

const slideGenerateRequestSchema = z.object({
	documentId: z.string().trim().min(1),
	fullText: z.string().trim().min(1),
	summary: z.string().trim().min(1),
	tocItems: z.array(tocItemSchema).min(1),
	selectedTocItemId: z.string().trim().min(1),
	themeId: themeIdSchema.default('classic-blue'),
	goalPrompt: z.string().trim().optional(),
	themePrompt: z.string().trim().optional(),
	templateHtml: z.string().trim().optional(),
	contextVersion: z.number().int().nonnegative().optional()
});

function buildGoalPrompt(input: z.infer<typeof slideGenerateRequestSchema>): string {
	return (
		input.goalPrompt ??
		[
			'Generate one presentation slide for the selected TOC item.',
			'Use concise headings and clear bullet points.',
			'Keep content factual and aligned with the source document.'
		].join(' ')
	);
}

function buildThemePrompt(input: z.infer<typeof slideGenerateRequestSchema>): string {
	return (
		input.themePrompt ??
		[
			`Theme: ${input.themeId}.`,
			'Use visual hierarchy with title, key points, and optional supporting detail.',
			'Output should fit a single slide.'
		].join(' ')
	);
}

function resolveTemplateHtml(input: z.infer<typeof slideGenerateRequestSchema>): string {
	if (input.templateHtml && input.templateHtml.length > 0) {
		return input.templateHtml;
	}
	return getThemeTemplate(input.themeId as ThemeTemplateId).html;
}

export const POST = withApiHandler(async ({ request }) => {
	const rawBody = await request.json();
	const input = slideGenerateRequestSchema.parse(rawBody);

	const selectedTocItem = input.tocItems.find((item) => item.id === input.selectedTocItemId);
	if (!selectedTocItem) {
		throw apiError({
			code: 'VALIDATION_ERROR',
			status: 400,
			message: 'selectedTocItemId does not exist in tocItems'
		});
	}

	const templateHtml = resolveTemplateHtml(input);
	const goalPrompt = buildGoalPrompt(input);
	const themePrompt = buildThemePrompt(input);

	const provider = getDefaultLlmProvider();
	const generated = await provider.generateSlide({
		documentId: input.documentId,
		fullText: input.fullText,
		summary: input.summary,
		tocItems: input.tocItems,
		selectedTocItem,
		goalPrompt,
		themePrompt,
		templateHtml,
		contextVersion: input.contextVersion
	});

	const rendered = renderSlideTemplate({
		templateHtml,
		slideContents: generated.slideHtml,
		slideCss: generated.slideCss
	});
	const validation = validateGeneratedSlide({
		slideHtml: generated.slideHtml,
		slideCss: generated.slideCss,
		renderedHtml: rendered.html
	});
	if (!validation.valid) {
		throw apiError({
			code: 'MODEL_ERROR',
			status: 502,
			message: 'Generated slide failed HTML validation',
			details: {
				issues: validation.issues
			}
		});
	}

	return slideGenerateResultSchema.parse({
		documentId: input.documentId,
		selectedTocItemId: selectedTocItem.id,
		themeId: input.themeId,
		slideHtml: generated.slideHtml,
		slideCss: generated.slideCss,
		renderedHtml: rendered.html,
		rationale: generated.rationale,
		usedContextVersion: generated.usedContextVersion
	});
});

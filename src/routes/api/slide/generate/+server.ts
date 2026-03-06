import { z } from 'zod';

import { getDefaultLlmProvider, RetryExhaustedError, runWithRetry } from '$lib/server/llm';
import { renderSlideTemplate, validateGeneratedSlide } from '$lib/server/slide';
import { getThemeTemplate, type ThemeTemplateId } from '$lib/templates/themes';
import {
	ApiError,
	apiError,
	slideGenerateResultSchema,
	tocItemSchema,
	withApiHandler
} from '$lib/server/validation';

const themeIdSchema = z.string().trim().min(1).default('classic-blue');
const MAX_GENERATE_ATTEMPTS = 3;
const GENERATE_BACKOFF_MS = [300, 800];
const THEME_TEMPLATE_ALIASES: Record<string, ThemeTemplateId> = {
	'classic-blue': 'classic-blue',
	'forest-green': 'forest-green',
	'sunset-orange': 'sunset-orange',
	'mono-gray': 'mono-gray',
	'midnight-teal': 'forest-green',
	'royal-maroon': 'sunset-orange',
	'ocean-ice': 'classic-blue',
	'sand-stone': 'mono-gray',
	'violet-night': 'classic-blue',
	'ruby-carbon': 'mono-gray',
	'mint-slate': 'forest-green',
	'cobalt-gold': 'sunset-orange'
};

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
	const resolvedTemplateThemeId = resolveTemplateThemeId(input.themeId);
	return (
		input.themePrompt ??
		[
			`Theme: ${input.themeId}.`,
			`Use template base: ${resolvedTemplateThemeId}.`,
			'Use visual hierarchy with title, key points, and optional supporting detail.',
			'Output should fit a single slide.'
		].join(' ')
	);
}

function resolveTemplateThemeId(themeId: string): ThemeTemplateId {
	return THEME_TEMPLATE_ALIASES[themeId] ?? 'classic-blue';
}

function resolveTemplateHtml(input: z.infer<typeof slideGenerateRequestSchema>): string {
	if (input.templateHtml && input.templateHtml.length > 0) {
		return input.templateHtml;
	}
	return getThemeTemplate(resolveTemplateThemeId(input.themeId)).html;
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
	const shouldRetry = (error: unknown): boolean => {
		if (error instanceof ApiError) {
			if (error.code === 'VALIDATION_ERROR') return false;
			if (error.code === 'UNAUTHORIZED') return false;
			if (error.code === 'FORBIDDEN') return false;
			if (error.code === 'NOT_FOUND') return false;
			if (error.code === 'CONFLICT') return false;
			return true;
		}
		return true;
	};

	const retryResult = await runWithRetry(
		async () => {
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

			return { generated, rendered };
		},
		{
			maxAttempts: MAX_GENERATE_ATTEMPTS,
			backoffMs: GENERATE_BACKOFF_MS,
			shouldRetry
		}
	).catch((error) => {
		if (error instanceof RetryExhaustedError) {
			throw apiError({
				code: 'MODEL_ERROR',
				status: 502,
				message: 'Slide generation failed after retry attempts',
				details: {
					attempts: error.attempts,
					delaysUsedMs: error.delaysUsedMs,
					lastError: error.lastError instanceof Error ? error.lastError.message : String(error.lastError)
				}
			});
		}
		throw error;
	});

	return slideGenerateResultSchema.parse({
		documentId: input.documentId,
		selectedTocItemId: selectedTocItem.id,
		themeId: input.themeId,
		slideHtml: retryResult.result.generated.slideHtml,
		slideCss: retryResult.result.generated.slideCss,
		renderedHtml: retryResult.result.rendered.html,
		rationale: retryResult.result.generated.rationale,
		usedContextVersion: retryResult.result.generated.usedContextVersion,
		retry: {
			attempt: retryResult.attempt,
			maxAttempts: MAX_GENERATE_ATTEMPTS,
			delaysUsedMs: retryResult.delaysUsedMs
		}
	});
});

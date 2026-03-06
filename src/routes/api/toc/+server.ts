import { z } from 'zod';

import { chunkPdfText, normalizeText, type ParsedPage } from '$lib/server/pdf';
import { getDefaultLlmProvider, type TocItem } from '$lib/server/llm';
import { numberDuplicateTitles } from '$lib/server/slide/toc';
import { apiError, tocResultSchema, withApiHandler } from '$lib/server/validation';

const tocRequestSchema = z.object({
	documentId: z.string().trim().min(1),
	fullText: z.string().trim().min(1),
	summary: z.preprocess(
		(value) => (typeof value === 'string' ? value : undefined),
		z.string().trim().optional()
	),
	language: z.string().trim().optional(),
	stylePrompt: z.preprocess(
		(value) => (typeof value === 'string' ? value : undefined),
		z.string().trim().optional()
	),
	pageMap: z
		.array(
			z.object({
				page: z.number().int().positive(),
				text: z.string().optional(),
				start: z.number().int().nonnegative(),
				end: z.number().int().nonnegative()
			})
		)
		.optional()
});

const DIRECT_TOC_MAX_CHARS = 14000;
const MAX_CHUNKS_FOR_TOC = 8;

function buildFallbackPageMap(text: string): ParsedPage[] {
	return [
		{
			page: 1,
			text,
			start: 0,
			end: text.length
		}
	];
}

function toParsedPageMap(input: z.infer<typeof tocRequestSchema>): ParsedPage[] {
	if (!input.pageMap || input.pageMap.length === 0) {
		return buildFallbackPageMap(input.fullText);
	}

	return input.pageMap.map((page) => ({
		page: page.page,
		text: page.text ?? '',
		start: page.start,
		end: page.end
	}));
}

function normalizeTocItems(items: TocItem[]): TocItem[] {
	const normalized = items
		.filter((item) => item.title.trim().length > 0)
		.map((item, index) => ({
			...item,
			id: item.id || `toc-${index + 1}`,
			order: index + 1,
			title: item.title.trim()
		}));

	return numberDuplicateTitles(normalized);
}

export const POST = withApiHandler(async ({ request }) => {
	const rawBody = await request.json();
	const input = tocRequestSchema.parse(rawBody);
	const language = input.language ?? 'ko';
	const normalizedText = normalizeText(input.fullText);
	const normalizedSummary = input.summary ? normalizeText(input.summary) : undefined;
	const normalizedStylePrompt = input.stylePrompt ? normalizeText(input.stylePrompt) : undefined;

	if (normalizedText.length < 50) {
		throw apiError({
			code: 'VALIDATION_ERROR',
			status: 400,
			message: 'fullText is too short to create table of contents'
		});
	}

	const provider = getDefaultLlmProvider();

	if (normalizedText.length <= DIRECT_TOC_MAX_CHARS) {
		const direct = await provider.generateToc({
			documentId: input.documentId,
			fullText: normalizedText,
			summary: normalizedSummary,
			language,
			stylePrompt: normalizedStylePrompt
		});

		return tocResultSchema.parse({
			documentId: input.documentId,
			tocItems: normalizeTocItems(direct.tocItems),
			meta: {
				chunked: false,
				chunkCount: 1
			}
		});
	}

	const pageMap = toParsedPageMap({
		...input,
		fullText: normalizedText
	});
	const chunks = chunkPdfText(normalizedText, pageMap, {
		maxChars: 7000,
		overlapChars: 600,
		minChunkChars: 1200
	});

	const selectedChunks = chunks.slice(0, MAX_CHUNKS_FOR_TOC);
	const partialTocs: TocItem[][] = [];

	for (const chunk of selectedChunks) {
		const partial = await provider.generateToc({
			documentId: `${input.documentId}:${chunk.id}`,
			fullText: chunk.text,
			summary: normalizedSummary,
			language,
			stylePrompt: normalizedStylePrompt
		});
		partialTocs.push(partial.tocItems);
	}

	const mergedTocText = partialTocs
		.map((items, idx) => {
			const list = items.map((item, order) => `${order + 1}. ${item.title}`).join('\n');
			return `Chunk ${idx + 1} TOC:\n${list}`;
		})
		.join('\n\n');

	const finalToc = await provider.generateToc({
		documentId: `${input.documentId}:merged`,
		fullText: mergedTocText,
		summary: normalizedSummary,
		language,
		stylePrompt: normalizedStylePrompt
	});

	return tocResultSchema.parse({
		documentId: input.documentId,
		tocItems: normalizeTocItems(finalToc.tocItems),
		meta: {
			chunked: true,
			chunkCount: selectedChunks.length,
			truncated: chunks.length > selectedChunks.length
		}
	});
}, {
	timeoutMs: 600_000,
	rateLimit: {
		windowMs: 60_000,
		max: 30
	}
});

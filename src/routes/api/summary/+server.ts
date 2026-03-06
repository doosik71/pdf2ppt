import { z } from 'zod';

import { chunkPdfText, normalizeText, type ParsedPage } from '$lib/server/pdf';
import { getDefaultLlmProvider } from '$lib/server/llm';
import { apiError, summaryResultSchema, withApiHandler } from '$lib/server/validation';

const summaryRequestSchema = z.object({
	documentId: z.string().trim().min(1),
	fullText: z.string().trim().min(1),
	language: z.string().trim().optional(),
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

const DIRECT_SUMMARY_MAX_CHARS = 12000;
const MAX_CHUNKS_FOR_SUMMARY = 8;

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

function toParsedPageMap(input: z.infer<typeof summaryRequestSchema>): ParsedPage[] {
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

function uniqueKeyPoints(points: string[]): string[] {
	const seen = new Set<string>();
	const output: string[] = [];

	for (const point of points) {
		const normalized = point.trim();
		if (!normalized) continue;
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		output.push(normalized);
	}

	return output;
}

export const POST = withApiHandler(async ({ request }) => {
	const rawBody = await request.json();
	const input = summaryRequestSchema.parse(rawBody);
	const language = input.language ?? 'ko';
	const normalizedText = normalizeText(input.fullText);

	if (normalizedText.length < 50) {
		throw apiError({
			code: 'VALIDATION_ERROR',
			status: 400,
			message: 'fullText is too short to summarize'
		});
	}

	const provider = getDefaultLlmProvider();

	if (normalizedText.length <= DIRECT_SUMMARY_MAX_CHARS) {
		const direct = await provider.summarize({
			documentId: input.documentId,
			fullText: normalizedText,
			language
		});

		return summaryResultSchema.parse({
			documentId: input.documentId,
			summary: direct.summary,
			keyPoints: uniqueKeyPoints(direct.keyPoints),
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

	const selectedChunks = chunks.slice(0, MAX_CHUNKS_FOR_SUMMARY);
	const partialResults = [];
	for (const chunk of selectedChunks) {
		const partial = await provider.summarize({
			documentId: `${input.documentId}:${chunk.id}`,
			fullText: chunk.text,
			language
		});
		partialResults.push(partial);
	}

	const mergedText = partialResults
		.map((result, index) => {
			const points = result.keyPoints.map((point) => `- ${point}`).join('\n');
			return `Chunk ${index + 1} Summary:\n${result.summary}\nChunk ${index + 1} Key Points:\n${points}`;
		})
		.join('\n\n');

	const finalSummary = await provider.summarize({
		documentId: `${input.documentId}:merged`,
		fullText: mergedText,
		language
	});

	return summaryResultSchema.parse({
		documentId: input.documentId,
		summary: finalSummary.summary,
		keyPoints: uniqueKeyPoints([...finalSummary.keyPoints, ...partialResults.flatMap((x) => x.keyPoints)]).slice(
			0,
			15
		),
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
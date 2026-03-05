import type { ParsedPage } from './parse';

export interface TextChunk {
	id: string;
	text: string;
	start: number;
	end: number;
	pageStart: number;
	pageEnd: number;
	charLength: number;
	estimatedTokens: number;
}

export interface ChunkOptions {
	maxChars?: number;
	overlapChars?: number;
	minChunkChars?: number;
}

const DEFAULT_MAX_CHARS = 7000;
const DEFAULT_OVERLAP_CHARS = 500;
const DEFAULT_MIN_CHUNK_CHARS = 1200;

function estimateTokens(text: string): number {
	// Rough heuristic for mixed Korean/English text.
	return Math.ceil(text.length / 2.5);
}

function pageRangeForSlice(
	pageMap: ParsedPage[],
	start: number,
	end: number
): { pageStart: number; pageEnd: number } {
	let pageStart = pageMap[0]?.page ?? 1;
	let pageEnd = pageMap[pageMap.length - 1]?.page ?? 1;

	for (const page of pageMap) {
		if (start <= page.end) {
			pageStart = page.page;
			break;
		}
	}

	for (const page of pageMap) {
		if (end <= page.end) {
			pageEnd = page.page;
			return { pageStart, pageEnd };
		}
	}

	return { pageStart, pageEnd };
}

function clampOptions(options: ChunkOptions) {
	const maxChars = Math.max(1000, options.maxChars ?? DEFAULT_MAX_CHARS);
	const overlapChars = Math.max(0, Math.min(maxChars - 200, options.overlapChars ?? DEFAULT_OVERLAP_CHARS));
	const minChunkChars = Math.max(200, Math.min(maxChars, options.minChunkChars ?? DEFAULT_MIN_CHUNK_CHARS));

	return { maxChars, overlapChars, minChunkChars };
}

export function chunkPdfText(
	fullText: string,
	pageMap: ParsedPage[],
	options: ChunkOptions = {}
): TextChunk[] {
	const input = fullText.trim();
	if (!input) return [];

	const { maxChars, overlapChars, minChunkChars } = clampOptions(options);
	const chunks: TextChunk[] = [];

	let cursor = 0;
	while (cursor < input.length) {
		let end = Math.min(cursor + maxChars, input.length);
		if (end < input.length) {
			const boundaryWindowStart = Math.max(cursor + minChunkChars, end - 800);
			const window = input.slice(boundaryWindowStart, end);
			const splitAtDoubleLine = window.lastIndexOf('\n\n');
			const splitAtLine = window.lastIndexOf('\n');
			const splitAtSentence = Math.max(
				window.lastIndexOf('. '),
				window.lastIndexOf('? '),
				window.lastIndexOf('! ')
			);

			const best = Math.max(splitAtDoubleLine, splitAtLine, splitAtSentence);
			if (best > 0) {
				end = boundaryWindowStart + best + 1;
			}
		}

		const text = input.slice(cursor, end).trim();
		if (!text) break;

		const range = pageRangeForSlice(pageMap, cursor, end);
		chunks.push({
			id: `chunk-${chunks.length + 1}`,
			text,
			start: cursor,
			end,
			pageStart: range.pageStart,
			pageEnd: range.pageEnd,
			charLength: text.length,
			estimatedTokens: estimateTokens(text)
		});

		if (end >= input.length) break;
		cursor = Math.max(0, end - overlapChars);
	}

	return chunks;
}

import { PDFParse } from 'pdf-parse';

export interface ParsedPage {
	page: number;
	text: string;
	start: number;
	end: number;
}

export interface ParsePdfResult {
	documentId: string;
	fullText: string;
	pageMap: ParsedPage[];
	metadata: {
		filename: string;
		size: number;
		mimeType: string;
		totalPages: number;
	};
}

export function normalizeText(input: string): string {
	return input
		.replace(/\r\n?/g, '\n')
		.replace(/\u00a0/g, ' ')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.split('\n')
		.map((line) => line.trim())
		.join('\n')
		.trim();
}

function buildPageMap(pages: Array<{ num: number; text: string }>): ParsedPage[] {
	const pageMap: ParsedPage[] = [];
	let cursor = 0;

	for (const page of pages) {
		const text = normalizeText(page.text);
		const start = cursor;
		const end = start + text.length;

		pageMap.push({
			page: page.num,
			text,
			start,
			end
		});

		cursor = end + 2;
	}

	return pageMap;
}

function joinPages(pageMap: ParsedPage[]): string {
	return pageMap.map((page) => page.text).join('\n\n');
}

export async function parsePdfFile(file: File): Promise<ParsePdfResult> {
	const documentId = crypto.randomUUID();
	const rawBytes = new Uint8Array(await file.arrayBuffer());

	const parser = new PDFParse({ data: rawBytes });
	try {
		const textResult = await parser.getText();
		const pageMap = buildPageMap(textResult.pages);
		const fullText = normalizeText(joinPages(pageMap));

		return {
			documentId,
			fullText,
			pageMap,
			metadata: {
				filename: file.name,
				size: file.size,
				mimeType: file.type || 'application/pdf',
				totalPages: textResult.total
			}
		};
	} finally {
		await parser.destroy();
	}
}

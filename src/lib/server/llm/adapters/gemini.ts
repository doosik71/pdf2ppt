import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

import { getServerEnv } from '$lib/server/env';
import type {
	GenerateSlideInput,
	GenerateSlideOutput,
	GenerateTocInput,
	GenerateTocOutput,
	LlmProvider,
	SummarizeInput,
	SummarizeOutput,
	TocItem
} from '../provider';

const summarizeSchema = z.object({
	summary: z.string().trim().min(1),
	keyPoints: z.array(z.string().trim().min(1)).min(1)
});

const generateTocSchema = z.object({
	tocItems: z
		.array(
			z.object({
				title: z.string().trim().min(1),
				sourceSpan: z
					.object({
						start: z.number().int().nonnegative(),
						end: z.number().int().nonnegative()
					})
					.optional()
			})
		)
		.min(1)
});

const generateSlideSchema = z.object({
	slideHtml: z.string().trim().min(1),
	slideCss: z.string().trim().min(1),
	rationale: z.string().trim().optional(),
	usedContextVersion: z.number().int().nonnegative().optional()
});

export class GeminiAdapter implements LlmProvider {
	private readonly ai: GoogleGenAI;
	private readonly model: string;

	constructor(model?: string) {
		const { GEMINI_API_KEY, GEMINI_MODEL_ID } = getServerEnv();
		this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
		this.model = model ?? GEMINI_MODEL_ID ?? 'gemini-2.5-flash';
	}

	async summarize(input: SummarizeInput): Promise<SummarizeOutput> {
		const prompt = [
			'You are a document analyst.',
			'Return strict JSON with shape: {"summary": string, "keyPoints": string[]}.',
			'Summary must be concise and keyPoints must contain concrete bullets.',
			`Language: ${input.language ?? 'ko'}.`,
			'Document:',
			input.fullText
		].join('\n');

		return this.generateStructuredOutput(prompt, summarizeSchema);
	}

	async generateToc(input: GenerateTocInput): Promise<GenerateTocOutput> {
		const prompt = [
			'You are an expert presentation planner.',
			'Create a slide table of contents from the document.',
			'Return strict JSON with shape: {"tocItems":[{"title": string, "sourceSpan":{"start":number,"end":number} }]}',
			'Each toc item must correspond to one slide.',
			`Language: ${input.language ?? 'ko'}.`,
			'Style preference (optional):',
			input.stylePrompt ?? '',
			'Optional summary:',
			input.summary ?? '',
			'Document:',
			input.fullText
		].join('\n');

		const parsed = await this.generateStructuredOutput(prompt, generateTocSchema);
		return {
			tocItems: parsed.tocItems.map((item, index) => this.toTocItem(item, index))
		};
	}

	async generateSlide(input: GenerateSlideInput): Promise<GenerateSlideOutput> {
		const prompt = [
			'You are a slide generator that must fill a provided HTML template.',
			'Return strict JSON with shape: {"slideHtml": string, "slideCss": string, "rationale"?: string, "usedContextVersion"?: number}.',
			'slideHtml must contain only inner body elements for [SLIDE_CONTENTS_HERE], not the full template. Do not include <html>, <head>, or <body> tags.',
			'Goal prompt:',
			input.goalPrompt,
			'Theme/style prompt:',
			input.themePrompt,
			`Context version: ${input.contextVersion ?? 0}`,
			`Force context reset: ${input.forceContextReset ? 'yes' : 'no'}`,
			'Selected TOC item:',
			JSON.stringify(input.selectedTocItem),
			'All TOC items:',
			JSON.stringify(input.tocItems),
			'Summary:',
			input.summary,
			'Template HTML:',
			input.templateHtml,
			'Document:',
			input.fullText
		].join('\n');

		const parsed = await this.generateStructuredOutput(prompt, generateSlideSchema);
		return {
			...parsed,
			usedContextVersion: parsed.usedContextVersion ?? input.contextVersion
		};
	}

	private async generateStructuredOutput<T>(
		prompt: string,
		schema: z.ZodType<T>
	): Promise<T> {
		const fallbackModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
		const candidateModels = [this.model, ...fallbackModels].filter(
			(modelId, index, self) => !!modelId && self.indexOf(modelId) === index
		);

		let response: Awaited<ReturnType<typeof this.ai.models.generateContent>> | null = null;
		let lastError: unknown;
		for (const modelId of candidateModels) {
			try {
				response = await this.ai.models.generateContent({
					model: modelId,
					contents: prompt,
					config: {
						responseMimeType: 'application/json'
					}
				});
				break;
			} catch (error) {
				lastError = error;
				const message = error instanceof Error ? error.message : String(error);
				if (/not found|unsupported|404/i.test(message)) {
					continue;
				}
				throw error;
			}
		}

		if (!response) {
			throw lastError instanceof Error ? lastError : new Error(String(lastError));
		}

		const text = response.text?.trim();
		if (!text) {
			throw new Error('Gemini response text is empty');
		}

		const jsonText = this.extractJson(text);
		const parsedJson = JSON.parse(jsonText);
		return schema.parse(parsedJson);
	}

	private extractJson(text: string): string {
		const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
		if (fencedMatch?.[1]) {
			return fencedMatch[1];
		}
		return text;
	}

	private toTocItem(
		item: z.infer<typeof generateTocSchema>['tocItems'][number],
		index: number
	): TocItem {
		return {
			id: `toc-${index + 1}`,
			title: item.title,
			order: index + 1,
			sourceSpan: item.sourceSpan
		};
	}
}

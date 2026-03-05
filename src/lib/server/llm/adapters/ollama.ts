import { Ollama } from 'ollama';
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

export class OllamaAdapter implements LlmProvider {
	private readonly client: Ollama;
	private readonly model: string;

	constructor(model?: string) {
		const { OLLAMA_BASE_URL, OLLAMA_MODEL_ID } = getServerEnv();
		if (!OLLAMA_BASE_URL || !OLLAMA_MODEL_ID) {
			throw new Error(
				'OllamaAdapter requires OLLAMA_BASE_URL and OLLAMA_MODEL_ID environment variables'
			);
		}

		this.client = new Ollama({ host: OLLAMA_BASE_URL });
		this.model = model ?? OLLAMA_MODEL_ID;
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
			'Only include slide body markup in slideHtml (no <html>, <head>, <body>).',
			'Goal prompt:',
			input.goalPrompt,
			'Theme/style prompt:',
			input.themePrompt,
			`Context version: ${input.contextVersion ?? 0}`,
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
		const response = await this.client.chat({
			model: this.model,
			stream: false,
			format: 'json',
			messages: [{ role: 'user', content: prompt }]
		});

		const text = response.message?.content?.trim();
		if (!text) {
			throw new Error('Ollama response text is empty');
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

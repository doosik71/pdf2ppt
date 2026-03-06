export interface SummarizeInput {
	documentId: string;
	fullText: string;
	language?: string;
}

export interface SummarizeOutput {
	summary: string;
	keyPoints: string[];
}

export interface TocItem {
	id: string;
	title: string;
	order: number;
	sourceSpan?: {
		start: number;
		end: number;
	};
}

export interface GenerateTocInput {
	documentId: string;
	fullText: string;
	summary?: string;
	language?: string;
	stylePrompt?: string;
}

export interface GenerateTocOutput {
	tocItems: TocItem[];
}

export interface GenerateSlideInput {
	documentId: string;
	fullText: string;
	summary?: string;
	tocItems: TocItem[];
	selectedTocItem: TocItem;
	goalPrompt: string;
	themePrompt: string;
	templateHtml: string;
	contextVersion?: number;
	forceContextReset?: boolean;
}

export interface GenerateSlideOutput {
	slideHtml: string;
	slideCss: string;
	rationale?: string;
	usedContextVersion?: number;
}

export interface LlmProvider {
	summarize(input: SummarizeInput): Promise<SummarizeOutput>;
	generateToc(input: GenerateTocInput): Promise<GenerateTocOutput>;
	generateSlide(input: GenerateSlideInput): Promise<GenerateSlideOutput>;
}

<script lang="ts">
	const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
	type ParseResult = {
		documentId: string;
		fullText: string;
		pageMap: Array<{ page: number; text: string; start: number; end: number }>;
		metadata: { filename: string; size: number; mimeType: string; totalPages: number };
	};

	type SummaryResult = {
		documentId: string;
		summary: string;
		keyPoints: string[];
		meta: {
			chunked: boolean;
			chunkCount: number;
			truncated?: boolean;
		};
	};

	type TocItem = {
		id: string;
		title: string;
		order: number;
		sourceSpan?: { start: number; end: number };
	};

	type TocResult = {
		documentId: string;
		tocItems: TocItem[];
		meta: {
			chunked: boolean;
			chunkCount: number;
			truncated?: boolean;
		};
	};

	type SlideGenerateResult = {
		documentId: string;
		selectedTocItemId: string;
		themeId: string;
		slideHtml: string;
		slideCss: string;
		renderedHtml: string;
		rationale?: string;
		usedContextVersion?: number;
	};

	type SlideFeedbackReason = 'STYLE_MISMATCH' | 'CONTENT_MISMATCH' | 'HTML_BROKEN';

	type SlideFeedbackResult = {
		feedbackId: string;
		documentId: string;
		selectedTocItemId: string;
		liked: boolean;
		reason?: SlideFeedbackReason;
		regeneration: {
			goalPromptPatch: string;
			themePromptPatch: string;
			shouldResetContext: boolean;
		};
	};

	type ThemePreset = {
		id: string;
		name: string;
		description: string;
		colors: [string, string, string];
	};

	type StylePreset = {
		id: string;
		name: string;
		speaker: string;
		audience: string;
		purpose: string;
		tone: string;
	};

	const themePresets: ThemePreset[] = [
		{
			id: 'classic-blue',
			name: 'Classic Blue',
			description: 'Stable blue tone for formal business presentations',
			colors: ['#0f172a', '#2563eb', '#e2e8f0']
		},
		{
			id: 'forest-green',
			name: 'Forest Green',
			description: 'Calm green tone for research and education topics',
			colors: ['#052e16', '#16a34a', '#dcfce7']
		},
		{
			id: 'sunset-orange',
			name: 'Sunset Orange',
			description: 'Strong orange tone for product and marketing decks',
			colors: ['#7c2d12', '#ea580c', '#ffedd5']
		},
		{
			id: 'mono-gray',
			name: 'Mono Gray',
			description: 'Minimal monochrome style for reports',
			colors: ['#111827', '#6b7280', '#f3f4f6']
		},
		{
			id: 'midnight-teal',
			name: 'Midnight Teal',
			description: 'Deep teal contrast for strategy updates',
			colors: ['#042f2e', '#0f766e', '#ccfbf1']
		},
		{
			id: 'royal-maroon',
			name: 'Royal Maroon',
			description: 'Premium maroon tone for board-level reports',
			colors: ['#4c0519', '#be123c', '#ffe4e6']
		},
		{
			id: 'ocean-ice',
			name: 'Ocean Ice',
			description: 'Fresh cyan palette for product demos',
			colors: ['#083344', '#0891b2', '#cffafe']
		},
		{
			id: 'sand-stone',
			name: 'Sand Stone',
			description: 'Warm neutral palette for policy documents',
			colors: ['#44403c', '#a16207', '#fef3c7']
		},
		{
			id: 'violet-night',
			name: 'Violet Night',
			description: 'Strong violet contrast for roadmap storytelling',
			colors: ['#2e1065', '#7c3aed', '#ede9fe']
		},
		{
			id: 'ruby-carbon',
			name: 'Ruby Carbon',
			description: 'Dark carbon base with ruby accents for risk briefings',
			colors: ['#1f2937', '#dc2626', '#fee2e2']
		},
		{
			id: 'mint-slate',
			name: 'Mint Slate',
			description: 'Soft mint highlights for educational material',
			colors: ['#134e4a', '#14b8a6', '#ccfbf1']
		},
		{
			id: 'cobalt-gold',
			name: 'Cobalt Gold',
			description: 'Cobalt and gold mix for keynote narratives',
			colors: ['#172554', '#ca8a04', '#fef9c3']
		}
	];

	const stylePresets: StylePreset[] = [
		{
			id: 'executive-briefing',
			name: 'Executive Briefing',
			speaker: 'Project lead',
			audience: 'Executives',
			purpose: 'Decision support',
			tone: 'Concise and strategic'
		},
		{
			id: 'research-seminar',
			name: 'Research Seminar',
			speaker: 'Researcher',
			audience: 'Technical peers',
			purpose: 'Share methods and findings',
			tone: 'Evidence-driven and precise'
		},
		{
			id: 'classroom-lecture',
			name: 'Classroom Lecture',
			speaker: 'Instructor',
			audience: 'Students',
			purpose: 'Teach concepts clearly',
			tone: 'Educational and structured'
		},
		{
			id: 'sales-pitch',
			name: 'Sales Pitch',
			speaker: 'Business presenter',
			audience: 'Potential clients',
			purpose: 'Persuade and convert',
			tone: 'Confident and value-focused'
		},
		{
			id: 'startup-demo',
			name: 'Startup Demo',
			speaker: 'Founder',
			audience: 'Investors',
			purpose: 'Show traction and vision',
			tone: 'Energetic and concise'
		},
		{
			id: 'policy-briefing',
			name: 'Policy Briefing',
			speaker: 'Analyst',
			audience: 'Public stakeholders',
			purpose: 'Explain policy implications',
			tone: 'Neutral and structured'
		},
		{
			id: 'training-workshop',
			name: 'Training Workshop',
			speaker: 'Facilitator',
			audience: 'Practitioners',
			purpose: 'Enable hands-on execution',
			tone: 'Practical and stepwise'
		},
		{
			id: 'incident-review',
			name: 'Incident Review',
			speaker: 'Incident commander',
			audience: 'Engineering leadership',
			purpose: 'Analyze failure and actions',
			tone: 'Direct and accountable'
		}
	];

	let selectedFile: File | null = null;
	let isDragOver = false;
	let isUploading = false;
	let isSummarizing = false;
	let isGeneratingToc = false;
	let isGeneratingSlide = false;
	let isSubmittingFeedback = false;
	let lastFailedAction: 'upload' | 'summary' | 'toc' | 'slide' | 'feedback' | null = null;

	let uploadError = '';
	let summaryError = '';
	let tocError = '';
	let slideError = '';
	let feedbackError = '';
	let feedbackSuccess = '';

	let parseResult: ParseResult | null = null;
	let summaryResult: SummaryResult | null = null;
	let tocResult: TocResult | null = null;
	let slideResult: SlideGenerateResult | null = null;
	let feedbackResult: SlideFeedbackResult | null = null;

	let selectedTocItemId: string | null = null;
	let selectedThemeId = themePresets[0].id;
	let selectedStyleId = stylePresets[0].id;
	let isThemeSectionCollapsed = false;
	let isStyleSectionCollapsed = false;
	let selectedDislikeReason: SlideFeedbackReason | null = null;
	let feedbackComment = '';
	let feedbackGoalPromptPatch = '';
	let feedbackThemePromptPatch = '';
	let slideContextVersion = 0;
	let forceContextReset = false;
	let previewFrame: HTMLIFrameElement | null = null;
	let lastFeedbackPayload: { liked: boolean; reason?: SlideFeedbackReason; comment?: string } | null = null;

	$: isBusy = isUploading || isSummarizing || isGeneratingToc || isGeneratingSlide || isSubmittingFeedback;
	$: busyLabel = isUploading
		? 'Uploading and parsing PDF...'
		: isSummarizing
			? 'Generating summary...'
			: isGeneratingToc
				? 'Generating table of contents...'
				: isGeneratingSlide
					? 'Generating slide preview...'
					: isSubmittingFeedback
						? 'Submitting feedback...'
					: '';

	function logApiError(
		action: string,
		responseStatus: number | null,
		payload: unknown,
		requestBody: unknown
	) {
		const error = (payload as { error?: Record<string, unknown> } | null)?.error;
		console.group(`[${action}] API request failed`);
		console.error('HTTP status:', responseStatus ?? 'unknown');
		console.error('Request body:', requestBody);
		console.error('Error message:', error?.message ?? 'unknown');
		if (error?.code) console.error('Error code:', error.code);
		if (error?.requestId) console.error('Request ID:', error.requestId);
		if (error?.details !== undefined) console.error('Error details:', error.details);
		console.error('Raw payload:', payload);
		console.groupEnd();
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function sanitizeFeedbackComment(rawComment: string): string {
		const withoutScriptTags = rawComment.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ');
		const withoutHtmlTags = withoutScriptTags.replace(/<\/?[^>]+>/g, ' ');
		const withoutCodeFences = withoutHtmlTags.replace(/```[\s\S]*?```/g, ' ');
		const flattened = withoutCodeFences.replace(/\s+/g, ' ').trim();
		return flattened.slice(0, 500);
	}

	function sanitizeRenderedHtml(html: string): string {
		if (typeof DOMParser === 'undefined') return html;
		const parser = new DOMParser();
		const documentNode = parser.parseFromString(html, 'text/html');
		const blockedTags = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base'];

		for (const tag of blockedTags) {
			documentNode.querySelectorAll(tag).forEach((node) => node.remove());
		}

		const allElements = documentNode.querySelectorAll('*');
		for (const element of allElements) {
			for (const attr of [...element.attributes]) {
				const attrName = attr.name.toLowerCase();
				const attrValue = attr.value.trim().toLowerCase();
				if (attrName.startsWith('on')) {
					element.removeAttribute(attr.name);
					continue;
				}
				if ((attrName === 'href' || attrName === 'src') && attrValue.startsWith('javascript:')) {
					element.removeAttribute(attr.name);
				}
			}
		}

		return `<!doctype html>\n${documentNode.documentElement.outerHTML}`;
	}

	function sanitizeFileNamePart(value: string): string {
		return value
			.replace(/[\\/:*?"<>|]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 60);
	}

	function getSelectedTocItem(): TocItem | undefined {
		if (!tocResult || !selectedTocItemId) return undefined;
		return tocResult.tocItems.find((item) => item.id === selectedTocItemId);
	}

	function buildExportFileName(extension: 'html' | 'svg' | 'png'): string {
		const rawDocumentName = parseResult?.metadata.filename ?? 'document';
		const documentBase = sanitizeFileNamePart(rawDocumentName.replace(/\.[^.]+$/, '')) || 'document';
		const tocItem = getSelectedTocItem();
		const serial = String(tocItem?.order ?? 1).padStart(3, '0');
		const tocTitle = sanitizeFileNamePart(tocItem?.title ?? 'slide');
		return `${documentBase}_${serial}_${tocTitle}.${extension}`;
	}

	function triggerContextReset(reason: string) {
		slideContextVersion += 1;
		forceContextReset = true;
		console.info(
			`[context.reset] triggered reason="${reason}" nextContextVersion=${slideContextVersion}`
		);
	}

	function logContextInfo(action: 'generate-request' | 'generate-response', extra?: Record<string, unknown>) {
		console.info(`[context.${action}]`, {
			contextVersion: slideContextVersion,
			forceContextReset,
			...extra
		});
	}

	function downloadSlideHtml() {
		if (!slideResult) return;
		const blob = new Blob([slideResult.renderedHtml], { type: 'text/html;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = buildExportFileName('html');
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
	}

	function resetAllResults() {
		summaryResult = null;
		tocResult = null;
		slideResult = null;
		feedbackResult = null;
		selectedTocItemId = null;
		summaryError = '';
		tocError = '';
		slideError = '';
		feedbackError = '';
		feedbackSuccess = '';
		selectedDislikeReason = null;
		feedbackComment = '';
		feedbackGoalPromptPatch = '';
		feedbackThemePromptPatch = '';
		slideContextVersion = 0;
		forceContextReset = false;
		lastFeedbackPayload = null;
		lastFailedAction = null;
	}

	function selectFile(file: File | null) {
		uploadError = '';
		parseResult = null;
		resetAllResults();

		if (!file) {
			selectedFile = null;
			return;
		}

		if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
			selectedFile = null;
			uploadError = 'Only PDF files are allowed.';
			return;
		}
		if (file.size > MAX_PDF_SIZE_BYTES) {
			selectedFile = null;
			uploadError = `PDF file is too large. Max size is ${MAX_PDF_SIZE_BYTES} bytes`;
			return;
		}

		selectedFile = file;
	}

	function onFileChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		selectFile(target.files?.[0] ?? null);
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function onDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
		selectFile(event.dataTransfer?.files?.[0] ?? null);
	}

	async function uploadPdf() {
		if (!selectedFile || isUploading) return;
		isUploading = true;
		uploadError = '';
		parseResult = null;
		resetAllResults();

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);

			const response = await fetch('/api/pdf/parse', { method: 'POST', body: formData });
			const payload = await response.json();

			if (!response.ok || !payload?.ok) {
				uploadError = payload?.error?.message ?? 'Failed to parse PDF.';
				lastFailedAction = 'upload';
				return;
			}

			parseResult = payload.data as ParseResult;
		} catch {
			uploadError = 'An error occurred while uploading the file.';
			lastFailedAction = 'upload';
		} finally {
			isUploading = false;
		}
	}

	async function generateSummary() {
		if (!parseResult || isSummarizing) return;
		isSummarizing = true;
		summaryError = '';
		summaryResult = null;
		tocResult = null;
		slideResult = null;
		selectedTocItemId = null;

		try {
			const response = await fetch('/api/summary', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					documentId: parseResult.documentId,
					fullText: parseResult.fullText,
					pageMap: parseResult.pageMap,
					language: 'ko'
				})
			});
			const payload = await response.json();

			if (!response.ok || !payload?.ok) {
				summaryError = payload?.error?.message ?? 'Failed to generate summary.';
				lastFailedAction = 'summary';
				return;
			}

			summaryResult = payload.data as SummaryResult;
		} catch {
			summaryError = 'An error occurred while generating summary.';
			lastFailedAction = 'summary';
		} finally {
			isSummarizing = false;
		}
	}

	async function generateToc() {
		if (!parseResult || isGeneratingToc) return;
		isGeneratingToc = true;
		tocError = '';
		tocResult = null;
		slideResult = null;
		selectedTocItemId = null;
		const summaryText = summaryResult?.summary?.trim();
		const stylePrompt = buildStylePrompt().trim();
		const requestBody = {
			documentId: parseResult.documentId,
			fullText: parseResult.fullText,
			pageMap: parseResult.pageMap,
			language: 'ko',
			...(summaryText ? { summary: summaryText } : {}),
			...(stylePrompt ? { stylePrompt } : {})
		};

		try {
			const response = await fetch('/api/toc', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(requestBody)
			});
			const payload = await response.json();

			if (!response.ok || !payload?.ok) {
				tocError = payload?.error?.message ?? 'Failed to generate table of contents.';
				lastFailedAction = 'toc';
				logApiError('Generate TOC', response.status, payload, requestBody);
				return;
			}

			tocResult = payload.data as TocResult;
			selectedTocItemId = tocResult.tocItems[0]?.id ?? null;
		} catch (error) {
			tocError = 'An error occurred while generating table of contents.';
			lastFailedAction = 'toc';
			logApiError('Generate TOC', null, { error: { message: String(error) } }, requestBody);
		} finally {
			isGeneratingToc = false;
		}
	}

	function buildStylePrompt() {
		const style = stylePresets.find((item) => item.id === selectedStyleId);
		if (!style) return '';
		return [
			`Style: ${style.name}`,
			`Speaker: ${style.speaker}`,
			`Audience: ${style.audience}`,
			`Purpose: ${style.purpose}`,
			`Tone: ${style.tone}`
		].join('\n');
	}

	function buildGoalPrompt() {
		const base = 'Generate one slide for the selected TOC item with concise and factual content.';
		return [base, feedbackGoalPromptPatch].filter(Boolean).join('\n');
	}

	function buildThemePrompt() {
		return [buildStylePrompt(), feedbackThemePromptPatch].filter(Boolean).join('\n');
	}

	async function generateSlidePreview() {
		if (!parseResult || !tocResult || !selectedTocItemId || isGeneratingSlide) return;

		isGeneratingSlide = true;
		slideError = '';
		slideResult = null;
		const requestBody = {
			documentId: parseResult.documentId,
			fullText: parseResult.fullText,
			summary: summaryResult?.summary,
			tocItems: tocResult.tocItems,
			selectedTocItemId,
			themeId: selectedThemeId,
			goalPrompt: buildGoalPrompt(),
			themePrompt: buildThemePrompt(),
			contextVersion: slideContextVersion,
			forceContextReset
		};
		logContextInfo('generate-request', {
			selectedTocItemId,
			themeId: selectedThemeId,
			styleId: selectedStyleId
		});

		try {
			const response = await fetch('/api/slide/generate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(requestBody)
			});
			const payload = await response.json();

			if (!response.ok || !payload?.ok) {
				slideError = payload?.error?.message ?? 'Failed to generate slide preview.';
				lastFailedAction = 'slide';
				logApiError('Generate Slide', response.status, payload, requestBody);
				return;
			}

			slideResult = payload.data as SlideGenerateResult;
			slideResult = {
				...slideResult,
				renderedHtml: sanitizeRenderedHtml(slideResult.renderedHtml)
			};
			logContextInfo('generate-response', {
				usedContextVersion: slideResult.usedContextVersion ?? slideContextVersion
			});
			feedbackError = '';
			feedbackSuccess = '';
			feedbackResult = null;
			selectedDislikeReason = null;
			forceContextReset = false;
		} catch (error) {
			slideError = 'An error occurred while generating slide preview.';
			lastFailedAction = 'slide';
			logApiError('Generate Slide', null, { error: { message: String(error) } }, requestBody);
		} finally {
			isGeneratingSlide = false;
		}
	}

	function retryLastAction() {
		if (lastFailedAction === 'upload') {
			void uploadPdf();
			return;
		}
		if (lastFailedAction === 'summary') {
			void generateSummary();
			return;
		}
		if (lastFailedAction === 'toc') {
			void generateToc();
			return;
		}
		if (lastFailedAction === 'slide') {
			void generateSlidePreview();
			return;
		}
		if (lastFailedAction === 'feedback' && lastFeedbackPayload) {
			void submitFeedback(
				lastFeedbackPayload.liked,
				lastFeedbackPayload.reason,
				lastFeedbackPayload.comment
			);
		}
	}

	function selectTocItem(itemId: string) {
		selectedTocItemId = itemId;
		slideResult = null;
		slideError = '';
		feedbackResult = null;
		feedbackError = '';
		feedbackSuccess = '';
		selectedDislikeReason = null;
		feedbackComment = '';
	}

	function selectTheme(themeId: string) {
		selectedThemeId = themeId;
		slideResult = null;
		slideError = '';
		feedbackResult = null;
		feedbackError = '';
		feedbackSuccess = '';
	}

	function selectStyle(styleId: string) {
		selectedStyleId = styleId;
		slideResult = null;
		slideError = '';
		feedbackResult = null;
		feedbackError = '';
		feedbackSuccess = '';
	}

	function toggleThemeSection() {
		isThemeSectionCollapsed = !isThemeSectionCollapsed;
	}

	function toggleStyleSection() {
		isStyleSectionCollapsed = !isStyleSectionCollapsed;
	}

	async function submitFeedback(liked: boolean, reason?: SlideFeedbackReason, comment?: string) {
		if (!parseResult || !slideResult || !selectedTocItemId || isSubmittingFeedback) return;
		if (!liked && !reason) {
			feedbackError = 'Please select a dislike reason.';
			return;
		}
		const sanitizedComment = sanitizeFeedbackComment(comment ?? feedbackComment);

		isSubmittingFeedback = true;
		feedbackError = '';
		feedbackSuccess = '';
		lastFeedbackPayload = { liked, reason, comment: sanitizedComment };

		try {
			const response = await fetch('/api/slide/feedback', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					documentId: parseResult.documentId,
					selectedTocItemId,
					liked,
					reason,
					comment: sanitizedComment || undefined
				})
			});
			const payload = await response.json();
			if (!response.ok || !payload?.ok) {
				feedbackError = payload?.error?.message ?? 'Failed to submit feedback.';
				lastFailedAction = 'feedback';
				return;
			}

			feedbackResult = payload.data as SlideFeedbackResult;
			feedbackGoalPromptPatch = feedbackResult.regeneration.goalPromptPatch;
			feedbackThemePromptPatch = feedbackResult.regeneration.themePromptPatch;
			if (feedbackResult.regeneration.shouldResetContext) {
				triggerContextReset(`feedback:${feedbackResult.reason ?? 'generic'}`);
			}
			feedbackSuccess = liked
				? 'Feedback saved. Current style will be preserved.'
				: 'Feedback saved. Regeneration prompt has been strengthened.';
		} catch {
			feedbackError = 'An error occurred while submitting feedback.';
			lastFailedAction = 'feedback';
		} finally {
			isSubmittingFeedback = false;
		}
	}

</script>

<main class="mx-auto min-h-screen w-full max-w-5xl px-4 py-10">
	<section class="mb-6">
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">PPT2Slide</h1>
		<p class="mt-2 text-sm text-slate-600">Upload a PDF and generate analysis outputs step by step.</p>
	</section>

	{#if isBusy}
		<section class="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
			<div class="flex items-center justify-between gap-3">
				<p>{busyLabel}</p>
				<span class="h-2 w-2 animate-pulse rounded-full bg-blue-600"></span>
			</div>
		</section>
	{/if}

	<section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<h2 class="text-lg font-semibold text-slate-900">1. PDF Upload</h2>
		<div
			class={`mt-4 rounded-lg border-2 border-dashed p-6 text-center transition ${
				isDragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
			}`}
			role="button"
			tabindex="0"
			on:dragover={onDragOver}
			on:dragleave={onDragLeave}
			on:drop={onDrop}
		>
			<p class="text-sm text-slate-700">Drag and drop a PDF here, or choose a file manually.</p>
			<label for="pdf-upload" class="mt-4 inline-flex cursor-pointer items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Choose File</label>
			<input id="pdf-upload" class="hidden" type="file" accept="application/pdf,.pdf" on:change={onFileChange} />
		</div>
		{#if selectedFile}
			<div class="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
				<div><span class="font-medium">File:</span> {selectedFile.name}</div>
				<div><span class="font-medium">Size:</span> {formatBytes(selectedFile.size)}</div>
			</div>
		{/if}
		{#if uploadError}
			<div class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
				<p class="text-sm text-red-700">{uploadError}</p>
				<button type="button" class="mt-2 text-xs font-medium text-red-700 underline underline-offset-2" on:click={retryLastAction} disabled={isBusy}>Retry</button>
			</div>
		{/if}
		<div class="mt-4 flex items-center justify-end gap-3">
			<button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300" on:click={uploadPdf} disabled={!selectedFile || isUploading}>
				{#if isUploading}
					<span class="inline-flex items-center gap-2">
						<span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
						<span>Uploading...</span>
					</span>
				{:else}
					Upload and Parse
				{/if}
			</button>
		</div>
	</section>

	{#if parseResult}
		<section class="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
			<h3 class="text-base font-semibold text-emerald-900">Upload Complete</h3>
			<p class="mt-2 text-sm text-emerald-800">Document ID: {parseResult.documentId}</p>
			<p class="mt-1 text-sm text-emerald-800">Pages: {parseResult.metadata.totalPages}</p>
			<p class="mt-1 text-sm text-emerald-800">Extracted characters: {parseResult.fullText.length}</p>
		</section>
	{/if}

	<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-lg font-semibold text-slate-900">2. Summary</h2>
			<button class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300" on:click={generateSummary} disabled={!parseResult || isSummarizing}>
				{#if isSummarizing}
					<span class="inline-flex items-center gap-2">
						<span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
						<span>Generating...</span>
					</span>
				{:else}
					Generate Summary
				{/if}
			</button>
		</div>
		{#if !parseResult}<p class="mt-3 text-sm text-slate-500">Upload a PDF first to enable summary generation.</p>{/if}
		{#if summaryError}
			<div class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
				<p class="text-sm text-red-700">{summaryError}</p>
				<button type="button" class="mt-2 text-xs font-medium text-red-700 underline underline-offset-2" on:click={retryLastAction} disabled={isBusy}>Retry</button>
			</div>
		{/if}
		{#if summaryResult}
			<div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
				<h3 class="text-sm font-semibold text-slate-900">Core Summary</h3>
				<p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{summaryResult.summary}</p>
				<h4 class="mt-4 text-sm font-semibold text-slate-900">Key Points</h4>
				<ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
					{#each summaryResult.keyPoints as point}<li>{point}</li>{/each}
				</ul>
				<p class="mt-4 text-xs text-slate-500">chunked: {summaryResult.meta.chunked ? 'yes' : 'no'} / chunkCount: {summaryResult.meta.chunkCount}</p>
			</div>
		{/if}
	</section>

	<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<div class="flex items-start justify-between gap-3">
			<div>
				<h2 class="text-lg font-semibold text-slate-900">3. Style Selection</h2>
				<p class="mt-2 text-sm text-slate-600">Choose a presentation style based on speaker, audience, and purpose.</p>
			</div>
			<button
				type="button"
				class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
				on:click={toggleStyleSection}
				aria-expanded={!isStyleSectionCollapsed}
				aria-label={isStyleSectionCollapsed ? 'Expand style section' : 'Shrink style section'}
				title={isStyleSectionCollapsed ? 'Expand' : 'Shrink'}
			>
				{isStyleSectionCollapsed ? '▼' : '▲'}
			</button>
		</div>
		{#if !isStyleSectionCollapsed}
			<div class="mt-4 grid max-h-96 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
				{#each stylePresets as style}
					<button type="button" class={`rounded-lg border p-4 text-left transition ${selectedStyleId === style.id ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`} on:click={() => selectStyle(style.id)}>
						<div class="flex items-center justify-between gap-3">
							<p class="text-sm font-semibold text-slate-900">{style.name}</p>
							{#if selectedStyleId === style.id}<span class="rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white">Selected</span>{/if}
						</div>
						<div class="mt-3 flex items-start gap-3">
							<svg
								width="128"
								height="128"
								viewBox="0 0 128 128"
								class="h-16 w-16 shrink-0 rounded-md border border-slate-200 bg-white p-1"
								aria-hidden="true"
							>
								{#if style.id === 'executive-briefing'}
									<rect x="10" y="14" width="108" height="100" rx="10" fill="#e2e8f0" />
									<rect x="20" y="28" width="58" height="10" rx="3" fill="#1e293b" />
									<rect x="20" y="48" width="40" height="8" rx="3" fill="#64748b" />
									<rect x="20" y="64" width="34" height="8" rx="3" fill="#64748b" />
									<rect x="84" y="44" width="22" height="42" rx="4" fill="#0ea5e9" />
								{:else if style.id === 'research-seminar'}
									<circle cx="64" cy="64" r="50" fill="#e0f2fe" />
									<path d="M24 76h80" stroke="#0369a1" stroke-width="6" />
									<path d="M32 52h64" stroke="#0284c7" stroke-width="6" />
									<circle cx="44" cy="48" r="8" fill="#0ea5e9" />
									<circle cx="78" cy="70" r="10" fill="#0284c7" />
								{:else if style.id === 'classroom-lecture'}
									<rect x="12" y="20" width="104" height="70" rx="8" fill="#ecfccb" />
									<rect x="18" y="26" width="92" height="58" rx="6" fill="#365314" />
									<path d="M26 40h44M26 54h56M26 68h38" stroke="#d9f99d" stroke-width="5" />
									<rect x="54" y="92" width="20" height="20" rx="4" fill="#84cc16" />
								{:else if style.id === 'sales-pitch'}
									<path d="M18 102l22-30 18 14 28-40 24 56z" fill="#ffedd5" />
									<path d="M18 102l22-30 18 14 28-40 24 56" stroke="#ea580c" stroke-width="6" fill="none" />
									<circle cx="86" cy="46" r="10" fill="#f97316" />
								{:else if style.id === 'startup-demo'}
									<rect x="16" y="18" width="96" height="92" rx="14" fill="#fef3c7" />
									<path d="M34 86l18-34 14 22 12-18 16 30z" fill="#f59e0b" />
									<circle cx="56" cy="40" r="8" fill="#ca8a04" />
								{:else if style.id === 'policy-briefing'}
									<rect x="20" y="14" width="88" height="100" rx="8" fill="#f1f5f9" />
									<path d="M34 34h60M34 50h60M34 66h48M34 82h54" stroke="#475569" stroke-width="6" />
									<circle cx="90" cy="82" r="10" fill="#0f766e" />
								{:else if style.id === 'training-workshop'}
									<rect x="14" y="18" width="100" height="92" rx="10" fill="#ede9fe" />
									<rect x="24" y="30" width="22" height="22" rx="4" fill="#7c3aed" />
									<rect x="24" y="60" width="22" height="22" rx="4" fill="#7c3aed" />
									<path d="M54 42h50M54 72h38" stroke="#5b21b6" stroke-width="6" />
								{:else}
									<circle cx="64" cy="64" r="48" fill="#fee2e2" />
									<path d="M34 84h60" stroke="#991b1b" stroke-width="8" />
									<path d="M42 50h44M42 66h44" stroke="#ef4444" stroke-width="6" />
									<path d="M64 28v16" stroke="#b91c1c" stroke-width="8" />
								{/if}
							</svg>
							<div class="space-y-1 text-xs text-slate-600">
								<p><span class="font-medium text-slate-700">Speaker:</span> {style.speaker}</p>
								<p><span class="font-medium text-slate-700">Audience:</span> {style.audience}</p>
								<p><span class="font-medium text-slate-700">Purpose:</span> {style.purpose}</p>
								<p><span class="font-medium text-slate-700">Tone:</span> {style.tone}</p>
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
		<p class="mt-3 text-xs text-slate-500">Current style: {stylePresets.find((style) => style.id === selectedStyleId)?.name}</p>
	</section>

	<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<div class="flex items-start justify-between gap-3">
			<div>
				<h2 class="text-lg font-semibold text-slate-900">4. Theme Selection</h2>
				<p class="mt-2 text-sm text-slate-600">Choose a color theme for generated slides.</p>
			</div>
			<button
				type="button"
				class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
				on:click={toggleThemeSection}
				aria-expanded={!isThemeSectionCollapsed}
				aria-label={isThemeSectionCollapsed ? 'Expand theme section' : 'Shrink theme section'}
				title={isThemeSectionCollapsed ? 'Expand' : 'Shrink'}
			>
				{isThemeSectionCollapsed ? '▼' : '▲'}
			</button>
		</div>
		{#if !isThemeSectionCollapsed}
			<div class="mt-4 grid max-h-96 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
				{#each themePresets as theme}
					<button type="button" class={`rounded-lg border p-4 text-left transition ${selectedThemeId === theme.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`} on:click={() => selectTheme(theme.id)}>
						<div class="flex items-center justify-between gap-3">
							<p class="text-sm font-semibold text-slate-900">{theme.name}</p>
							{#if selectedThemeId === theme.id}<span class="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">Selected</span>{/if}
						</div>
						<p class="mt-1 text-xs text-slate-600">{theme.description}</p>
						<div class="mt-3 flex gap-2">
							{#each theme.colors as color}<span class="h-6 flex-1 rounded" style={`background-color: ${color}`}></span>{/each}
						</div>
					</button>
				{/each}
			</div>
		{/if}
		<p class="mt-3 text-xs text-slate-500">Current theme: {themePresets.find((theme) => theme.id === selectedThemeId)?.name}</p>
	</section>

	<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-lg font-semibold text-slate-900">5. Table of Contents</h2>
			<button class="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-300" on:click={generateToc} disabled={!parseResult || isGeneratingToc}>
				{#if isGeneratingToc}
					<span class="inline-flex items-center gap-2">
						<span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
						<span>Generating...</span>
					</span>
				{:else}
					Generate TOC
				{/if}
			</button>
		</div>
		{#if !parseResult}<p class="mt-3 text-sm text-slate-500">Upload a PDF first to enable TOC generation.</p>{/if}
		{#if tocError}
			<div class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
				<p class="text-sm text-red-700">{tocError}</p>
				<button type="button" class="mt-2 text-xs font-medium text-red-700 underline underline-offset-2" on:click={retryLastAction} disabled={isBusy}>Retry</button>
			</div>
		{/if}
		{#if tocResult}
			<div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
				<div class="flex items-center justify-between gap-3">
					<h3 class="text-sm font-semibold text-slate-900">Slide TOC</h3>
					<span class="text-xs text-slate-500">
						Selected:
						{tocResult.tocItems.find((item) => item.id === selectedTocItemId)?.title ?? '-'}
					</span>
				</div>
				<ul class="mt-3 space-y-2">
					{#each tocResult.tocItems as item}
						<li>
							<button
								type="button"
								class={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition ${
									selectedTocItemId === item.id
										? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-200'
										: 'border-slate-200 bg-white hover:border-slate-300'
								}`}
								on:click={() => selectTocItem(item.id)}
							>
								<span class="mt-0.5 inline-flex min-w-7 justify-center rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{item.order}</span>
								<div class="min-w-0">
									<p class="break-words text-sm text-slate-800">{item.title}</p>
									{#if item.sourceSpan}
										<p class="mt-1 text-xs text-slate-500">source: {item.sourceSpan.start} - {item.sourceSpan.end}</p>
									{/if}
								</div>
								{#if selectedTocItemId === item.id}
									<span class="ml-auto rounded bg-cyan-600 px-2 py-0.5 text-xs font-medium text-white">Selected</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
				<p class="mt-4 text-xs text-slate-500">chunked: {tocResult.meta.chunked ? 'yes' : 'no'} / chunkCount: {tocResult.meta.chunkCount}</p>
			</div>
		{/if}
	</section>

	<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-lg font-semibold text-slate-900">6. Slide Preview</h2>
			<button
				class="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-violet-300"
				on:click={generateSlidePreview}
				disabled={!parseResult || !tocResult || !selectedTocItemId || isGeneratingSlide}
			>
				{#if isGeneratingSlide}
					<span class="inline-flex items-center gap-2">
						<span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
						<span>Generating...</span>
					</span>
				{:else}
					Generate Slide
				{/if}
			</button>
		</div>
		{#if !parseResult || !tocResult || !selectedTocItemId}
			<p class="mt-3 text-sm text-slate-500">Complete upload, TOC generation, and TOC item selection first.</p>
		{/if}
		{#if slideError}
			<div class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
				<p class="text-sm text-red-700">{slideError}</p>
				<button type="button" class="mt-2 text-xs font-medium text-red-700 underline underline-offset-2" on:click={retryLastAction} disabled={isBusy}>Retry</button>
			</div>
		{/if}
		{#if slideResult}
			<div class="mt-4 space-y-3">
				<div class="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
					<iframe
						title="Slide Preview"
						class="h-[420px] w-full bg-white"
						sandbox="allow-same-origin"
						srcdoc={slideResult.renderedHtml}
						bind:this={previewFrame}
					></iframe>
				</div>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<p class="text-xs text-slate-500">
						theme: {slideResult.themeId} / selected toc: {slideResult.selectedTocItemId} / contextVersion: {slideContextVersion}{forceContextReset ? ' (reset pending)' : ''}
					</p>
					<div class="flex flex-wrap items-center gap-2">
						<button
							type="button"
							class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
							on:click={downloadSlideHtml}
						>
							💾 HTML
						</button>
					</div>
				</div>

				<div class="rounded-lg border border-slate-200 bg-white p-4">
					<h3 class="text-sm font-semibold text-slate-900">7. Slide Feedback</h3>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<button
							type="button"
							class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
							on:click={() => submitFeedback(true, undefined, feedbackComment)}
							disabled={isSubmittingFeedback}
						>
							Like
						</button>
						<button
							type="button"
							class="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-300"
							on:click={() =>
								submitFeedback(false, selectedDislikeReason ?? undefined, feedbackComment)}
							disabled={isSubmittingFeedback}
						>
							Dislike
						</button>
					</div>

					<div class="mt-3 space-y-2">
						<p class="text-xs font-medium text-slate-700">If dislike, choose reason:</p>
						<label class="flex items-center gap-2 text-xs text-slate-700">
							<input
								type="radio"
								name="dislike-reason"
								value="STYLE_MISMATCH"
								checked={selectedDislikeReason === 'STYLE_MISMATCH'}
								on:change={() => (selectedDislikeReason = 'STYLE_MISMATCH')}
							/>
							Style mismatch
						</label>
						<label class="flex items-center gap-2 text-xs text-slate-700">
							<input
								type="radio"
								name="dislike-reason"
								value="CONTENT_MISMATCH"
								checked={selectedDislikeReason === 'CONTENT_MISMATCH'}
								on:change={() => (selectedDislikeReason = 'CONTENT_MISMATCH')}
							/>
							Content mismatch
						</label>
						<label class="flex items-center gap-2 text-xs text-slate-700">
							<input
								type="radio"
								name="dislike-reason"
								value="HTML_BROKEN"
								checked={selectedDislikeReason === 'HTML_BROKEN'}
								on:change={() => (selectedDislikeReason = 'HTML_BROKEN')}
							/>
							HTML broken
						</label>
					</div>
					<div class="mt-3 space-y-2">
						<label for="feedback-comment" class="text-xs font-medium text-slate-700">
							Other comments (optional)
						</label>
						<textarea
							id="feedback-comment"
							class="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-blue-300 transition focus:border-blue-400 focus:ring-2"
							placeholder="Add extra feedback for next regeneration."
							bind:value={feedbackComment}
							maxlength="2000"
						></textarea>
						<p class="text-xs text-slate-500">
							Potentially unsafe code-like tags (e.g. script tags) are removed before processing.
						</p>
					</div>

					<div class="mt-3 flex flex-wrap items-center gap-2">
						<button
							type="button"
							class="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
							on:click={generateSlidePreview}
							disabled={isBusy}
						>
							Regenerate with Feedback
						</button>
						<button
							type="button"
							class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
							on:click={() => triggerContextReset('manual')}
							disabled={isBusy}
						>
							Reset Context
						</button>
						<span class="text-xs text-slate-500">contextVersion: {slideContextVersion}</span>
					</div>

					{#if feedbackError}
						<div class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
							<p class="text-xs text-red-700">{feedbackError}</p>
							<button
								type="button"
								class="mt-1 text-xs font-medium text-red-700 underline underline-offset-2"
								on:click={retryLastAction}
								disabled={isBusy}
							>
								Retry
							</button>
						</div>
					{/if}
					{#if feedbackSuccess}
						<p class="mt-3 text-xs text-emerald-700">{feedbackSuccess}</p>
					{/if}
				</div>
			</div>
		{/if}
	</section>
</main>


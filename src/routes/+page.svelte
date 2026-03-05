<script lang="ts">
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
		}
	];

	let selectedFile: File | null = null;
	let isDragOver = false;
	let isUploading = false;
	let isSummarizing = false;
	let isGeneratingToc = false;
	let isGeneratingSlide = false;
	let lastFailedAction: 'upload' | 'summary' | 'toc' | 'slide' | null = null;

	let uploadError = '';
	let summaryError = '';
	let tocError = '';
	let slideError = '';

	let parseResult: ParseResult | null = null;
	let summaryResult: SummaryResult | null = null;
	let tocResult: TocResult | null = null;
	let slideResult: SlideGenerateResult | null = null;

	let selectedTocItemId: string | null = null;
	let selectedThemeId = themePresets[0].id;
	let selectedStyleId = stylePresets[0].id;

	$: isBusy = isUploading || isSummarizing || isGeneratingToc || isGeneratingSlide;
	$: busyLabel = isUploading
		? 'Uploading and parsing PDF...'
		: isSummarizing
			? 'Generating summary...'
			: isGeneratingToc
				? 'Generating table of contents...'
				: isGeneratingSlide
					? 'Generating slide preview...'
					: '';

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function resetAllResults() {
		summaryResult = null;
		tocResult = null;
		slideResult = null;
		selectedTocItemId = null;
		summaryError = '';
		tocError = '';
		slideError = '';
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

		try {
			const response = await fetch('/api/toc', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					documentId: parseResult.documentId,
					fullText: parseResult.fullText,
					summary: summaryResult?.summary,
					pageMap: parseResult.pageMap,
					language: 'ko'
				})
			});
			const payload = await response.json();

			if (!response.ok || !payload?.ok) {
				tocError = payload?.error?.message ?? 'Failed to generate table of contents.';
				lastFailedAction = 'toc';
				return;
			}

			tocResult = payload.data as TocResult;
			selectedTocItemId = tocResult.tocItems[0]?.id ?? null;
		} catch {
			tocError = 'An error occurred while generating table of contents.';
			lastFailedAction = 'toc';
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

	async function generateSlidePreview() {
		if (!parseResult || !summaryResult || !tocResult || !selectedTocItemId || isGeneratingSlide) return;

		isGeneratingSlide = true;
		slideError = '';
		slideResult = null;

		try {
			const response = await fetch('/api/slide/generate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					documentId: parseResult.documentId,
					fullText: parseResult.fullText,
					summary: summaryResult.summary,
					tocItems: tocResult.tocItems,
					selectedTocItemId,
					themeId: selectedThemeId,
					themePrompt: buildStylePrompt()
				})
			});
			const payload = await response.json();

			if (!response.ok || !payload?.ok) {
				slideError = payload?.error?.message ?? 'Failed to generate slide preview.';
				lastFailedAction = 'slide';
				return;
			}

			slideResult = payload.data as SlideGenerateResult;
		} catch {
			slideError = 'An error occurred while generating slide preview.';
			lastFailedAction = 'slide';
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
		}
	}

	function selectTocItem(itemId: string) {
		selectedTocItemId = itemId;
		slideResult = null;
		slideError = '';
	}

	function selectTheme(themeId: string) {
		selectedThemeId = themeId;
		slideResult = null;
		slideError = '';
	}

	function selectStyle(styleId: string) {
		selectedStyleId = styleId;
		slideResult = null;
		slideError = '';
	}
</script>

<main class="mx-auto min-h-screen w-full max-w-5xl px-4 py-10">
	<section class="mb-6">
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">PDF2PPT</h1>
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
		<div class="mt-4 flex items-center gap-3">
			<button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300" on:click={uploadPdf} disabled={!selectedFile || isUploading}>
				{isUploading ? 'Uploading...' : 'Upload and Parse'}
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
				{isSummarizing ? 'Generating...' : 'Generate Summary'}
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
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-lg font-semibold text-slate-900">3. Table of Contents</h2>
			<button class="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-300" on:click={generateToc} disabled={!parseResult || isGeneratingToc}>
				{isGeneratingToc ? 'Generating...' : 'Generate TOC'}
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
		<h2 class="text-lg font-semibold text-slate-900">4. Theme Selection</h2>
		<p class="mt-2 text-sm text-slate-600">Choose a color theme for generated slides.</p>
		<div class="mt-4 grid gap-3 sm:grid-cols-2">
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
		<p class="mt-3 text-xs text-slate-500">Current theme: {themePresets.find((theme) => theme.id === selectedThemeId)?.name}</p>
	</section>

	<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<h2 class="text-lg font-semibold text-slate-900">5. Style Selection</h2>
		<p class="mt-2 text-sm text-slate-600">Choose a presentation style based on speaker, audience, and purpose.</p>
		<div class="mt-4 grid gap-3 sm:grid-cols-2">
			{#each stylePresets as style}
				<button type="button" class={`rounded-lg border p-4 text-left transition ${selectedStyleId === style.id ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`} on:click={() => selectStyle(style.id)}>
					<div class="flex items-center justify-between gap-3">
						<p class="text-sm font-semibold text-slate-900">{style.name}</p>
						{#if selectedStyleId === style.id}<span class="rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white">Selected</span>{/if}
					</div>
					<div class="mt-2 space-y-1 text-xs text-slate-600">
						<p><span class="font-medium text-slate-700">Speaker:</span> {style.speaker}</p>
						<p><span class="font-medium text-slate-700">Audience:</span> {style.audience}</p>
						<p><span class="font-medium text-slate-700">Purpose:</span> {style.purpose}</p>
						<p><span class="font-medium text-slate-700">Tone:</span> {style.tone}</p>
					</div>
				</button>
			{/each}
		</div>
		<p class="mt-3 text-xs text-slate-500">Current style: {stylePresets.find((style) => style.id === selectedStyleId)?.name}</p>
	</section>

	<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-lg font-semibold text-slate-900">6. Slide Preview</h2>
			<button
				class="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-violet-300"
				on:click={generateSlidePreview}
				disabled={!parseResult || !summaryResult || !tocResult || !selectedTocItemId || isGeneratingSlide}
			>
				{isGeneratingSlide ? 'Generating...' : 'Generate Slide'}
			</button>
		</div>
		{#if !parseResult || !summaryResult || !tocResult || !selectedTocItemId}
			<p class="mt-3 text-sm text-slate-500">Complete upload, summary, TOC generation, and TOC item selection first.</p>
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
					></iframe>
				</div>
				<p class="text-xs text-slate-500">theme: {slideResult.themeId} / selected toc: {slideResult.selectedTocItemId}</p>
			</div>
		{/if}
	</section>
</main>

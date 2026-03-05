import { derived, writable, type Readable } from 'svelte/store';

export type DocumentState = {
	documentId: string;
	filename: string;
	fullText: string;
	pageMap: Array<{ page: number; text: string; start: number; end: number }>;
	totalPages: number;
};

export type SummaryState = {
	summary: string;
	keyPoints: string[];
	meta?: {
		chunked: boolean;
		chunkCount: number;
		truncated?: boolean;
	};
};

export type TocItemState = {
	id: string;
	title: string;
	order: number;
	sourceSpan?: { start: number; end: number };
};

export type TocState = {
	items: TocItemState[];
	meta?: {
		chunked: boolean;
		chunkCount: number;
		truncated?: boolean;
	};
};

export type SlideState = {
	html: string;
	css: string;
	svg?: string;
	status: 'idle' | 'generating' | 'ready' | 'error';
	error?: string;
};

export type AppState = {
	document: DocumentState | null;
	summary: SummaryState | null;
	toc: TocState | null;
	selectedItem: TocItemState | null;
	slide: SlideState;
};

const initialState: AppState = {
	document: null,
	summary: null,
	toc: null,
	selectedItem: null,
	slide: {
		html: '',
		css: '',
		status: 'idle'
	}
};

function createAppStore() {
	const { subscribe, set, update } = writable<AppState>(initialState);

	return {
		subscribe,

		reset: () => set(initialState),

		setDocument: (document: DocumentState) =>
			update((state) => ({
				...state,
				document,
				summary: null,
				toc: null,
				selectedItem: null,
				slide: { html: '', css: '', status: 'idle' }
			})),

		setSummary: (summary: SummaryState | null) =>
			update((state) => ({
				...state,
				summary
			})),

		setToc: (toc: TocState | null) =>
			update((state) => ({
				...state,
				toc,
				selectedItem: toc?.items[0] ?? null
			})),

		setSelectedItem: (item: TocItemState | null) =>
			update((state) => ({
				...state,
				selectedItem: item
			})),

		setSlide: (slide: SlideState) =>
			update((state) => ({
				...state,
				slide
			})),

		patchSlide: (patch: Partial<SlideState>) =>
			update((state) => ({
				...state,
				slide: {
					...state.slide,
					...patch
				}
			}))
	};
}

export const appStore = createAppStore();

export const canGenerateSummary: Readable<boolean> = derived(appStore, ($appStore) => !!$appStore.document);
export const canGenerateToc: Readable<boolean> = derived(appStore, ($appStore) => !!$appStore.document);
export const canGenerateSlide: Readable<boolean> = derived(
	appStore,
	($appStore) => !!$appStore.document && !!$appStore.toc && !!$appStore.selectedItem
);

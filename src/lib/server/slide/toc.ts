import type { TocItem } from '$lib/server/llm';

function normalizeBaseTitle(title: string): string {
	return title.trim().replace(/\s+\(\d+\)$/, '');
}

export function numberDuplicateTitles(items: TocItem[]): TocItem[] {
	const counts = new Map<string, number>();
	for (const item of items) {
		const baseTitle = normalizeBaseTitle(item.title);
		counts.set(baseTitle, (counts.get(baseTitle) ?? 0) + 1);
	}

	const sequence = new Map<string, number>();
	return items.map((item) => {
		const baseTitle = normalizeBaseTitle(item.title);
		const total = counts.get(baseTitle) ?? 1;
		if (total <= 1) {
			return { ...item, title: baseTitle };
		}

		const next = (sequence.get(baseTitle) ?? 0) + 1;
		sequence.set(baseTitle, next);
		return { ...item, title: `${baseTitle} (${next})` };
	});
}

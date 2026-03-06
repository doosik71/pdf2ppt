export type SlideFeedbackReason = 'STYLE_MISMATCH' | 'CONTENT_MISMATCH' | 'HTML_BROKEN';

export interface SlideFeedbackInput {
	liked: boolean;
	reason?: SlideFeedbackReason;
	comment?: string;
}

export interface FeedbackPromptEnhancement {
	goalPromptPatch: string;
	themePromptPatch: string;
	shouldResetContext: boolean;
}

export function sanitizeFeedbackComment(comment?: string): string {
	if (!comment) return '';
	const withoutScriptTags = comment.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ');
	const withoutHtmlTags = withoutScriptTags.replace(/<\/?[^>]+>/g, ' ');
	const withoutCodeFences = withoutHtmlTags.replace(/```[\s\S]*?```/g, ' ');
	return withoutCodeFences.replace(/\s+/g, ' ').trim().slice(0, 500);
}

export function buildFeedbackPromptEnhancement(
	input: SlideFeedbackInput
): FeedbackPromptEnhancement {
	const safeComment = sanitizeFeedbackComment(input.comment);
	const commentPatch = safeComment ? `Reflect this user comment: ${safeComment}` : '';

	if (input.liked) {
		return {
			goalPromptPatch: commentPatch,
			themePromptPatch: 'Preserve the current structure and tone. Keep close to the last accepted slide style.',
			shouldResetContext: false
		};
	}

	switch (input.reason) {
		case 'STYLE_MISMATCH':
			return {
				goalPromptPatch: [
					'Regenerate the same slide topic with stronger visual hierarchy and clearer presenter/audience alignment.',
					commentPatch
				]
					.filter(Boolean)
					.join('\n'),
				themePromptPatch:
					'Prioritize selected theme/style consistency. Improve typography contrast, spacing rhythm, and slide composition.',
				shouldResetContext: true
			};
		case 'CONTENT_MISMATCH':
			return {
				goalPromptPatch: [
					'Rebuild slide content strictly from document evidence for the selected TOC item. Avoid unrelated claims.',
					commentPatch
				]
					.filter(Boolean)
					.join('\n'),
				themePromptPatch:
					'Use concise bullets with factual statements and include only information supported by source context.',
				shouldResetContext: true
			};
		case 'HTML_BROKEN':
			return {
				goalPromptPatch: [
					'Regenerate with strict template conformance. Ensure valid and stable markup for preview rendering.',
					commentPatch
				]
					.filter(Boolean)
					.join('\n'),
				themePromptPatch:
					'Do not produce malformed tags. Keep semantic block structure and avoid unsupported HTML constructs.',
				shouldResetContext: true
			};
		default:
			return {
				goalPromptPatch: ['Regenerate with improved quality while preserving topic intent.', commentPatch]
					.filter(Boolean)
					.join('\n'),
				themePromptPatch: 'Improve readability and structure within the selected theme.',
				shouldResetContext: true
			};
	}
}

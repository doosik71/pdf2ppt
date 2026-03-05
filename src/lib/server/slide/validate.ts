import { parse } from 'parse5';

import { SLIDE_CONTENTS_TOKEN, SLIDE_CSS_TOKEN } from '$lib/templates/themes';

export interface SlideValidationInput {
	slideHtml: string;
	slideCss: string;
	renderedHtml: string;
}

export interface SlideValidationResult {
	valid: boolean;
	issues: string[];
}

type NodeLike = {
	nodeName?: string;
	tagName?: string;
	attrs?: Array<{ name: string; value: string }>;
	childNodes?: NodeLike[];
	value?: string;
};

function hasTag(node: NodeLike, tagName: string): boolean {
	if (node.tagName === tagName) return true;
	for (const child of node.childNodes ?? []) {
		if (hasTag(child, tagName)) return true;
	}
	return false;
}

function hasClass(node: NodeLike, className: string): boolean {
	const classAttr = node.attrs?.find((attr) => attr.name === 'class')?.value ?? '';
	if (classAttr.split(/\s+/).includes(className)) return true;
	for (const child of node.childNodes ?? []) {
		if (hasClass(child, className)) return true;
	}
	return false;
}

function collectText(node: NodeLike): string {
	let output = '';
	if (node.nodeName === '#text' && typeof node.value === 'string') {
		output += node.value;
	}
	for (const child of node.childNodes ?? []) {
		output += collectText(child);
	}
	return output;
}

export function validateGeneratedSlide(input: SlideValidationInput): SlideValidationResult {
	const issues: string[] = [];

	if (!input.slideHtml.trim()) issues.push('slideHtml is empty');
	if (!input.slideCss.trim()) issues.push('slideCss is empty');
	if (!input.renderedHtml.trim()) issues.push('renderedHtml is empty');

	if (
		input.renderedHtml.includes(SLIDE_CONTENTS_TOKEN) ||
		input.renderedHtml.includes(SLIDE_CSS_TOKEN)
	) {
		issues.push('template tokens were not fully replaced');
	}

	let documentNode: NodeLike | null = null;
	try {
		documentNode = parse(input.renderedHtml) as unknown as NodeLike;
	} catch {
		issues.push('failed to parse renderedHtml');
	}

	if (documentNode) {
		if (!hasTag(documentNode, 'section')) issues.push('required <section> block is missing');
		if (!hasTag(documentNode, 'style')) issues.push('required <style> block is missing');
		if (!hasClass(documentNode, 'slide')) issues.push('required .slide block is missing');
		if (!hasClass(documentNode, 'panel')) issues.push('required .panel block is missing');

		const textContent = collectText(documentNode).replace(/\s+/g, ' ').trim();
		if (textContent.length < 20) {
			issues.push('rendered content is too short');
		}
	}

	return {
		valid: issues.length === 0,
		issues
	};
}

import {
	SLIDE_CONTENTS_TOKEN,
	SLIDE_CSS_TOKEN,
	getThemeTemplate,
	type ThemeTemplate,
	type ThemeTemplateId
} from '$lib/templates/themes';

export interface RenderSlideTemplateInput {
	templateHtml: string;
	slideContents: string;
	slideCss: string;
}

export interface RenderedSlideTemplate {
	html: string;
}

function assertTemplateTokens(templateHtml: string): void {
	if (!templateHtml.includes(SLIDE_CONTENTS_TOKEN)) {
		throw new Error(`Template is missing required token: ${SLIDE_CONTENTS_TOKEN}`);
	}
	if (!templateHtml.includes(SLIDE_CSS_TOKEN)) {
		throw new Error(`Template is missing required token: ${SLIDE_CSS_TOKEN}`);
	}
}

function replaceAll(source: string, token: string, value: string): string {
	return source.split(token).join(value);
}

export function renderSlideTemplate(input: RenderSlideTemplateInput): RenderedSlideTemplate {
	assertTemplateTokens(input.templateHtml);

	const withContents = replaceAll(input.templateHtml, SLIDE_CONTENTS_TOKEN, input.slideContents.trim());
	const withCss = replaceAll(withContents, SLIDE_CSS_TOKEN, input.slideCss.trim());

	return {
		html: withCss
	};
}

export function renderThemeSlideTemplate(params: {
	themeId: ThemeTemplateId;
	slideContents: string;
	slideCss: string;
}): RenderedSlideTemplate {
	const template: ThemeTemplate = getThemeTemplate(params.themeId);
	return renderSlideTemplate({
		templateHtml: template.html,
		slideContents: params.slideContents,
		slideCss: params.slideCss
	});
}

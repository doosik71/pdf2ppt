import { classicBlueTemplate } from './classic-blue';
import { forestGreenTemplate } from './forest-green';
import { monoGrayTemplate } from './mono-gray';
import { sunsetOrangeTemplate } from './sunset-orange';
import { SLIDE_CONTENTS_TOKEN, SLIDE_CSS_TOKEN, type ThemeTemplate, type ThemeTemplateId } from './types';

const templates = [classicBlueTemplate, forestGreenTemplate, sunsetOrangeTemplate, monoGrayTemplate] as const;

const templateMap: Record<ThemeTemplateId, ThemeTemplate> = {
	'classic-blue': classicBlueTemplate,
	'forest-green': forestGreenTemplate,
	'sunset-orange': sunsetOrangeTemplate,
	'mono-gray': monoGrayTemplate
};

function hasRequiredTokens(template: ThemeTemplate): boolean {
	return template.html.includes(SLIDE_CONTENTS_TOKEN) && template.html.includes(SLIDE_CSS_TOKEN);
}

export function listThemeTemplates(): ThemeTemplate[] {
	return [...templates];
}

export function getThemeTemplate(themeId: ThemeTemplateId): ThemeTemplate {
	const template = templateMap[themeId];
	if (!template) {
		throw new Error(`Unknown theme template id: ${themeId}`);
	}
	if (!hasRequiredTokens(template)) {
		throw new Error(`Theme template "${themeId}" is missing required tokens`);
	}
	return template;
}

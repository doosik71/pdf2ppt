export const SLIDE_CONTENTS_TOKEN = '[SLIDE_CONTENTS_HERE]';
export const SLIDE_CSS_TOKEN = '[SLIDE_CSS_HERE]';

export type ThemeTemplateId = 'classic-blue' | 'forest-green' | 'sunset-orange' | 'mono-gray';

export interface ThemeTemplate {
	id: ThemeTemplateId;
	name: string;
	description: string;
	html: string;
}

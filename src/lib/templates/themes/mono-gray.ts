import { SLIDE_CONTENTS_TOKEN, SLIDE_CSS_TOKEN, type ThemeTemplate } from './types';

export const monoGrayTemplate: ThemeTemplate = {
	id: 'mono-gray',
	name: 'Mono Gray',
	description: 'Minimal monochrome style for reports',
	html: `
<section class="slide slide-mono-gray">
  <style>
    .slide.slide-mono-gray {
      width: 1366px;
      height: 768px;
      padding: 56px 64px;
      background: linear-gradient(140deg, #111827 0%, #374151 100%);
      color: #f9fafb;
      font-family: "Pretendard", "Noto Sans KR", sans-serif;
      box-sizing: border-box;
    }
    .slide.slide-mono-gray .panel {
      height: 100%;
      background: rgba(17, 24, 39, 0.58);
      border: 1px solid rgba(243, 244, 246, 0.24);
      border-radius: 20px;
      padding: 36px 40px;
      overflow: hidden;
    }
    ${SLIDE_CSS_TOKEN}
  </style>
  <div class="panel">
    ${SLIDE_CONTENTS_TOKEN}
  </div>
</section>
`.trim()
};

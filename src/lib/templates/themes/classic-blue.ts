import { SLIDE_CONTENTS_TOKEN, SLIDE_CSS_TOKEN, type ThemeTemplate } from './types';

export const classicBlueTemplate: ThemeTemplate = {
	id: 'classic-blue',
	name: 'Classic Blue',
	description: 'Stable blue tone for formal business presentations',
	html: `
<section class="slide slide-classic-blue">
  <style>
    .slide.slide-classic-blue {
      width: 1366px;
      height: 768px;
      padding: 56px 64px;
      background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
      color: #e2e8f0;
      font-family: "Pretendard", "Noto Sans KR", sans-serif;
      box-sizing: border-box;
    }
    .slide.slide-classic-blue .panel {
      height: 100%;
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid rgba(226, 232, 240, 0.2);
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

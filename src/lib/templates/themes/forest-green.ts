import { SLIDE_CONTENTS_TOKEN, SLIDE_CSS_TOKEN, type ThemeTemplate } from './types';

export const forestGreenTemplate: ThemeTemplate = {
	id: 'forest-green',
	name: 'Forest Green',
	description: 'Calm green tone for research and education topics',
	html: `
<section class="slide slide-forest-green">
  <style>
    .slide.slide-forest-green {
      width: 1366px;
      height: 768px;
      padding: 56px 64px;
      background: linear-gradient(135deg, #052e16 0%, #166534 100%);
      color: #ecfdf5;
      font-family: "Pretendard", "Noto Sans KR", sans-serif;
      box-sizing: border-box;
    }
    .slide.slide-forest-green .panel {
      height: 100%;
      background: rgba(5, 46, 22, 0.62);
      border: 1px solid rgba(220, 252, 231, 0.24);
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

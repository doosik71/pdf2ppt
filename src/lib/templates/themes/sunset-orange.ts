import { SLIDE_CONTENTS_TOKEN, SLIDE_CSS_TOKEN, type ThemeTemplate } from './types';

export const sunsetOrangeTemplate: ThemeTemplate = {
	id: 'sunset-orange',
	name: 'Sunset Orange',
	description: 'Strong orange tone for product and marketing decks',
	html: `
<section class="slide slide-sunset-orange">
  <style>
    .slide.slide-sunset-orange {
      width: 1366px;
      height: 768px;
      padding: 56px 64px;
      background: linear-gradient(130deg, #7c2d12 0%, #ea580c 100%);
      color: #fff7ed;
      font-family: "Pretendard", "Noto Sans KR", sans-serif;
      box-sizing: border-box;
    }
    .slide.slide-sunset-orange .panel {
      height: 100%;
      background: rgba(124, 45, 18, 0.52);
      border: 1px solid rgba(255, 237, 213, 0.28);
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

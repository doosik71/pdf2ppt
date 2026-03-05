# COMMENTS (Next Session Handoff)

## 현재 상태 요약

- 업로드/요약/목차/테마/스타일/목차선택/슬라이드 미리보기까지 End-to-End 기본 흐름이 구현됨.
- 서버 API는 `pdf/summary/toc/slide-generate`까지 구현 완료.
- 생성 슬라이드 HTML 검증(parse5 + 필수 블록 검사)까지 반영됨.
- 공통 API 에러 포맷과 `zod` 스키마 검증이 적용됨.

## 다음에 바로 진행할 우선순위

1. 생성 실패 재시도 정책 구현

- 대상: `/api/slide/generate` 호출부(서버)
- 해야 할 일:
  - 모델 호출 실패 시 백오프 재시도(예: 300ms, 800ms, 1500ms)
  - 최대 재시도 횟수(예: 3회)
  - 재시도 로그/시도횟수 응답 메타 반영

1. 평가(좋아요/싫어요) UX 및 API 구현

- 대상: 프론트 `+page.svelte`, 서버 `/api/slide/feedback`
- 해야 할 일:
  - UI: 좋아요/싫어요, 사유(스타일/내용/HTML)
  - API: feedback payload 저장(초기 in-memory 또는 구조만)
  - dislike 시 재생성 플로우 트리거 설계

1. 사유별 재생성 프롬프트 보강 규칙

- 대상: 서버 `slide` 도메인
- 해야 할 일:
  - 스타일 부적합 -> style 지시 강화
  - 내용 부적합 -> 근거 문맥 추가
  - HTML 깨짐 -> 구조 제약 강화

1. contextVersion/Reset 트리거

- 대상: `/api/slide/generate`, `/api/slide/feedback`
- 해야 할 일:
  - contextVersion 증가/반영
  - reset 필요조건(dislike 사유) 처리
  - 응답/로그에 version 노출

1. Export 기능

- 우선순위:
  - HTML(SVG 포함) 다운로드
  - PNG export(클라이언트 캡처)

## 기술 부채 / 리팩터 포인트

- `src/routes/+page.svelte` 단일 파일이 커졌음.
  - 권장 분리:
    - `UploadPanel.svelte`
    - `SummaryPanel.svelte`
    - `TocPanel.svelte`
    - `ThemeStylePanel.svelte`
    - `SlidePreviewPanel.svelte`
- `src/lib/stores/app.ts` 설계는 완료됐으나 페이지 실제 연동은 미완료.
  - 다음 세션에서 로컬 state를 store로 이관 권장.

## 검증/품질 관련 다음 작업

- 단위 테스트 추가:
  - `numberDuplicateTitles`
  - `renderSlideTemplate`
  - `validateGeneratedSlide`
- API 통합 테스트 추가:
  - `pdf -> summary -> toc -> slide/generate`
- 보안/운영:
  - `sanitize/CSP` 적용 강화
  - rate-limit/timeout 정책 구현

## 주의사항

- 사용자 요청에 따라 `COMMANDS.md`는 수정 금지.
- `.env`의 민감정보는 클라이언트 코드로 노출되지 않도록 유지.
- 모든 신규 API는 `withApiHandler` + `zod` 검증 패턴 유지.

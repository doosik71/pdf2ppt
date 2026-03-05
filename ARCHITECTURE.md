# ARCHITECTURE

## 1) 개요
PDF2PPT는 SvelteKit 기반 SPA + 서버 API 구조로 구현되어 있다.
핵심 흐름은 `PDF 파싱 -> 요약 생성 -> 목차 생성 -> 단건 슬라이드 생성/미리보기`이다.

## 2) 런타임 계층
- Client (Svelte SPA)
  - 단일 페이지에서 업로드/요약/목차/테마/스타일/목차선택/미리보기를 처리
- Server (SvelteKit API routes)
  - PDF 파싱, LLM 호출, 템플릿 적용, 검증, 표준 에러 응답 처리
- LLM Providers
  - Gemini Adapter
  - Ollama Adapter

## 3) 주요 모듈 구조 (클래스/인터페이스)

### LLM 추상화
- `src/lib/server/llm/provider.ts`
  - `interface LlmProvider`
    - `summarize(...)`
    - `generateToc(...)`
    - `generateSlide(...)`
  - 관련 입출력 타입(`SummarizeInput/Output`, `GenerateTocInput/Output`, `GenerateSlideInput/Output`, `TocItem`)

- `src/lib/server/llm/adapters/gemini.ts`
  - `class GeminiAdapter implements LlmProvider`
  - `@google/genai` 기반 구현

- `src/lib/server/llm/adapters/ollama.ts`
  - `class OllamaAdapter implements LlmProvider`
  - `ollama` client 기반 구현

- `src/lib/server/llm/factory.ts`
  - `createLlmProvider(providerName)`
  - `getDefaultLlmProvider()` (`DEFAULT_PROVIDER` 기반)

### 환경변수
- `src/lib/server/env/index.ts`
  - `$env/static/private` 기반 서버 전용 로더
  - provider별 필수 환경변수 검증 (`zod`)

### PDF 처리
- `src/lib/server/pdf/parse.ts`
  - `parsePdfFile(file)`
  - `normalizeText(...)`
  - `ParsePdfResult`, `ParsedPage`

- `src/lib/server/pdf/chunk.ts`
  - `chunkPdfText(...)`
  - `TextChunk`, `ChunkOptions`

### 슬라이드 템플릿/검증
- `src/lib/templates/themes/*`
  - 테마별 템플릿 정의 (`classic-blue`, `forest-green`, `sunset-orange`, `mono-gray`)
  - 공통 토큰: `[SLIDE_CONTENTS_HERE]`, `[SLIDE_CSS_HERE]`

- `src/lib/server/slide/template.ts`
  - `renderSlideTemplate(...)`
  - `renderThemeSlideTemplate(...)`
  - 토큰 존재 여부 검증 + 치환

- `src/lib/server/slide/validate.ts`
  - `validateGeneratedSlide(...)`
  - HTML 파싱(parse5) + 필수 블록 검사(`section`, `style`, `.slide`, `.panel`)

- `src/lib/server/slide/toc.ts`
  - `numberDuplicateTitles(...)`

### API 표준화/검증
- `src/lib/server/validation/api.ts`
  - `ApiError`, `apiError(...)`
  - `withApiHandler(...)`
  - 표준 에러 코드/포맷

- `src/lib/server/validation/analysis.ts`
  - 분석 결과 스키마 (`parsePdfResultSchema`, `summaryResultSchema`, `tocResultSchema`, `slideGenerateResultSchema`)

### 전역 상태 Store
- `src/lib/stores/app.ts`
  - `AppState`:
    - `document`, `summary`, `toc`, `selectedItem`, `slide`
  - 액션: `setDocument`, `setSummary`, `setToc`, `setSelectedItem`, `setSlide`, `patchSlide`, `reset`

## 4) API 엔드포인트
- `POST /api/pdf/parse`
- `POST /api/summary`
- `POST /api/toc`
- `POST /api/slide/generate`

모든 엔드포인트는 `withApiHandler` 기반으로 공통 에러/성공 포맷을 따른다.

## 5) 프론트엔드 구조
- `src/routes/+page.svelte`
  - 1. PDF Upload
  - 2. Summary
  - 3. Table of Contents
  - 4. Theme Selection
  - 5. Style Selection
  - 6. Slide Preview
  - 로딩/에러/재시도 UX 포함

## 6) 파일 구조 (핵심)
```text
src/
  routes/
    +layout.svelte
    +page.svelte
    api/
      pdf/parse/+server.ts
      summary/+server.ts
      toc/+server.ts
      slide/generate/+server.ts
  lib/
    stores/
      app.ts
      index.ts
    templates/
      index.ts
      themes/
        types.ts
        registry.ts
        classic-blue.ts
        forest-green.ts
        sunset-orange.ts
        mono-gray.ts
        index.ts
    server/
      env/index.ts
      llm/
        provider.ts
        factory.ts
        adapters/
          gemini.ts
          ollama.ts
          index.ts
        index.ts
      pdf/
        parse.ts
        chunk.ts
        index.ts
      slide/
        toc.ts
        template.ts
        validate.ts
        index.ts
      validation/
        api.ts
        analysis.ts
        index.ts
```

## 7) 현재 설계상 주의점
- `+page.svelte`에 UI/상태/요청 로직이 집중되어 있어, 다음 단계에서 컴포넌트 분리 필요
- `src/lib/stores/app.ts`는 설계 완료됐지만 현재 페이지와 완전 연동되지는 않음
- `/api/slide/generate`는 현재 `themePrompt`에 스타일 정보를 실어 전달 중이며, 별도 `stylePrompt` 필드 도입 여지 있음

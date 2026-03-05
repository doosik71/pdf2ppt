# PDF2PPT 개발 계획

## 1. 목표와 범위

- 목표: PDF 문서를 분석해 발표용 슬라이드를 페이지 단위로 생성하고, 사용자 피드백을 반영해 품질을 개선하는 SPA 웹앱 구현
- 지원 모델: `Gemini`, `Ollama`
- 배포 형태: Stateless 정적 웹 서버 + 서버리스/백엔드 API 엔드포인트
- 핵심 산출물:
  - PDF 업로드/분석/요약/목차 생성
  - 목차 기반 단일 슬라이드 생성
  - 테마/스타일 선택 기반 HTML(SVG 포함) 슬라이드 렌더링
  - 품질 평가(좋아요/문제 사유) 및 재생성 루프
  - PNG/HTML Export

## 2. 기술 스택 및 기본 원칙

- 프레임워크: `SvelteKit` (SPA 모드)
- 스타일: `Tailwind CSS`
- 패키지 매니저: `pnpm` (요청사항의 `npmp`는 오타로 보고 `pnpm` 적용)
- PDF 처리: 서버 측 텍스트 추출 라이브러리(`pdf-parse` 계열 또는 동급)
- 데이터 포맷 검증: `zod` 등 스키마 검증 도입
- 원칙:
  - 비밀정보(API key, Ollama URL, 모델 ID)는 서버에서만 접근
  - 클라이언트에는 최소 데이터만 전달
  - 동일 입력 시 재현 가능한 생성 파이프라인 설계

## 3. 상위 아키텍처

- 클라이언트(SPA):
  - 파일 업로드 UI, 요약/목차/슬라이드 생성 제어 UI, 미리보기, 평가, Export
- SvelteKit 서버 엔드포인트:
  - 업로드 파일 파싱, LLM 호출 오케스트레이션, 템플릿 결합, 결과 저장/반환
- LLM 추상화 계층:
  - Provider Adapter (`GeminiAdapter`, `OllamaAdapter`)
  - 공통 인터페이스: `summarize`, `generateToc`, `generateSlide`
- 임시 상태 저장소:
  - Stateless 배포 가정이므로 서버 메모리 의존 금지
  - 선택지:
    - 1순위: 클라이언트 세션스토리지 + 요청마다 필요한 컨텍스트 전달
    - 2순위: 외부 KV/Redis(선택)로 세션 상태 저장

## 4. 보안/비밀정보 설계

- 환경변수(서버 전용):
  - `GEMINI_API_KEY`
  - `OLLAMA_BASE_URL`
  - `OLLAMA_MODEL_ID`
  - `DEFAULT_PROVIDER` (`gemini` | `ollama`)
- SvelteKit 규칙:
  - 비밀값은 `$env/static/private` 또는 `$env/dynamic/private`만 사용
  - `$env/static/public`에 민감정보 배치 금지
- API 입력 검증:
  - 파일 형식/크기 제한
  - 문자열 길이 제한 및 HTML sanitize
- 출력 보안:
  - 생성 HTML 렌더링 시 CSP 적용
  - `iframe sandbox` 기반 미리보기 고려

## 5. 기능 요구사항 구현 계획

### 5.1 PDF 업로드 및 전처리

- 기능:
  - PDF 업로드
  - 텍스트 추출
  - 페이지/문단 단위 정규화
- 구현:
  - `POST /api/pdf/parse`
  - 반환: `documentId`, `fullText`, `pageMap`, `metadata`

### 5.2 요약 생성

- 기능:
  - 요약 버튼 클릭 시 핵심 요약 생성/표시
- 구현:
  - `POST /api/summary`
  - 입력: `documentId`, `fullText`
  - 출력: `summary`, `keyPoints[]`

### 5.3 목차 생성

- 기능:
  - 목차 생성 버튼 클릭 시 슬라이드용 목차 생성
  - 중복 제목 시 번호 자동 부여(예: `연구 방법 (1)`, `연구 방법 (2)`)
- 구현:
  - `POST /api/toc`
  - 출력: `tocItems[]` (`id`, `title`, `order`, `sourceSpan`)

### 5.4 테마/스타일 선택

- 기능:
  - 사전정의 테마 선택
  - 발표 스타일(화자 성향/청자/목적) 선택
- 구현:
  - 정적 JSON 또는 TS 상수로 프리셋 관리
  - 템플릿 토큰: `[SLIDE_CONTENTS_HERE]`, `[SLIDE_CSS_HERE]`

### 5.5 슬라이드 단건 생성

- 기능:
  - 목차에서 선택한 단일 항목만 생성
- 구현:
  - `POST /api/slide/generate`
  - 입력:
    - 목적 프롬프트
    - 테마/스타일 프롬프트
    - 문서 전체 내용
    - 요약
    - 전체 목차
    - 선택 목차 항목
    - 템플릿
  - 출력:
    - `slideHtml`, `slideCss`, `rationale`, `usedContextVersion`

### 5.6 평가 및 재생성

- 기능:
  - 좋아요/싫어요 + 사유(스타일 부적합/내용 부적합/HTML 형식 깨짐)
- 구현:
  - `POST /api/slide/feedback`
  - `dislike` 시 재생성 전략:
    - 스타일 부적합: 스타일 프롬프트 강화 후 재생성
    - 내용 부적합: 근거 문맥(원문 발췌) 추가 후 재생성
    - HTML 깨짐: 구조 검증 규칙 + 고정 템플릿 재주입

### 5.7 Export

- 기능:
  - PNG, HTML(SVG 포함) export
- 구현:
  - 클라이언트 캡처(`html-to-image` 계열) 또는 서버 렌더러(`playwright`) 중 선택
  - 초기 버전: 클라이언트 PNG/HTML 다운로드 우선

## 6. 프롬프트/컨텍스트 전략

### 6.1 기본 요청 구성

- 매 요청 공통:
  - 과제 목적 프롬프트
  - 테마/스타일 프롬프트
  - 문서 전체/요약/목차
  - 템플릿 + 토큰 위치 지시
  - 선택 목차 항목

### 6.2 토큰 절약 모드

- 조건:
  - Provider가 대화 이력을 안정적으로 유지하는 경우
- 방식:
  - 세션 `contextVersion` 관리
  - 중복 컨텍스트 생략, 선택 목차 및 변경점만 전달

### 6.3 컨텍스트 재주입(Reset) 트리거

- 트리거:
  - 사용자 평가가 `스타일 부적합/내용 부적합/HTML 깨짐`
  - 결과 검증 실패(HTML 파싱 실패, 필수 섹션 누락)
- 동작:
  - 누락된 핵심 프롬프트/문맥 전체 재전송
  - `contextVersion` 증가 및 이력 기록

## 7. 데이터 모델(초안)

- `Document`
  - `id`, `filename`, `fullText`, `summary`, `tocItems`, `createdAt`
- `SlideJob`
  - `id`, `documentId`, `tocItemId`, `themeId`, `styleId`, `status`, `contextVersion`
- `SlideResult`
  - `id`, `slideJobId`, `html`, `css`, `svg?`, `createdAt`
- `Feedback`
  - `id`, `slideResultId`, `liked`, `reason?`, `comment?`

## 8. API 설계(초안)

- `POST /api/pdf/parse`
- `POST /api/summary`
- `POST /api/toc`
- `POST /api/slide/generate`
- `POST /api/slide/feedback`
- `POST /api/slide/export/png` (옵션)
- `GET /api/health`

모든 API는 공통으로 다음 적용:

- 요청/응답 스키마 검증
- 에러 코드 표준화(`VALIDATION_ERROR`, `MODEL_ERROR`, `TIMEOUT`, `RATE_LIMIT`)
- 요청 단위 추적 ID 로깅

## 9. 프론트엔드 화면 구성(단일 페이지)

- 좌측 패널:
  - PDF 업로드
  - 요약 버튼/결과
  - 목차 생성 버튼/목차 리스트
  - 테마/스타일 선택
  - 생성 대상 목차 선택
- 우측 패널:
  - 슬라이드 미리보기
  - 평가 버튼(좋아요/싫어요 + 사유)
  - Export 버튼(PNG/HTML)
- 상태 관리:
  - Svelte store로 `document`, `summary`, `toc`, `currentSlide`, `feedbackQueue` 관리

## 10. 품질 보증 및 테스트 계획

- 단위 테스트:
  - 프롬프트 빌더
  - 제목 중복 번호 부여 로직
  - HTML 토큰 치환 로직
- 통합 테스트:
  - PDF 업로드 → 요약 → 목차 → 슬라이드 생성 플로우
  - 피드백 기반 재생성 플로우
- 회귀 테스트:
  - 깨진 HTML 자동 탐지(파서 기반)
  - 테마/스타일별 렌더링 스냅샷

## 11. 단계별 실행 일정(권장)

- Phase 1 (MVP 기반)
  - 프로젝트 초기 세팅(SvelteKit + Tailwind + pnpm)
  - PDF 파싱/요약/목차 API
  - 단건 슬라이드 생성 + 미리보기
- Phase 2 (품질 강화)
  - 피드백 수집 및 재생성 정책
  - 컨텍스트 절약/재주입 로직
  - HTML 안정성 검사
- Phase 3 (완성도)
  - Export 고도화(PNG/HTML/SVG)
  - 로깅/관측성/에러 핸들링 고도화
  - 테스트 자동화 및 배포 파이프라인

## 12. 리스크 및 대응

- 리스크: 장문 PDF로 인한 토큰 초과
  - 대응: 청크 요약 + 계층형 목차 생성
- 리스크: 모델별 출력 포맷 불안정
  - 대응: 엄격한 출력 스키마 + 재시도 + 후처리 정규화
- 리스크: Stateless 환경에서 세션 맥락 손실
  - 대응: 컨텍스트 재주입 정책 + 외부 KV 선택지 확보
- 리스크: HTML 렌더링 깨짐
  - 대응: 템플릿 고정 영역 보호 + 파서 검증 + 자동 복구 프롬프트

## 13. 완료 기준(Definition of Done)

- 필수 기능 9개(업로드~Export) 모두 동작
- Gemini/Ollama 전환 가능 및 서버 비밀정보 보호 검증 완료
- 피드백 기반 재생성 루프 정상 동작
- 주요 플로우 통합 테스트 통과
- 배포 환경에서 SPA + API 연동 정상 동작

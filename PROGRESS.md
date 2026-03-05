# PROGRESS

## 기준 시점

- 현재 세션 기준으로 Phase 0 ~ Phase 4 일부(슬라이드 생성/미리보기/검증)까지 구현됨.

## 완료된 항목

- 프로젝트 초기화
  - SvelteKit + TypeScript + Tailwind CSS 구성 완료
  - pnpm 기반 의존성 설치 완료 (`zod`, `pdf-parse`, `@google/genai`, `ollama`, `vitest`, `playwright`, `parse5` 등)
- 서버 기반 구조
  - 서버 전용 환경변수 로더 구현 (`$env/static/private`, provider별 필수값 검증)
  - LLM 추상 인터페이스 정의 (`summarize`, `generateToc`, `generateSlide`)
  - Gemini/Ollama Adapter 구현
  - `DEFAULT_PROVIDER` 기반 Provider 팩토리 구현
  - 공통 API 응답/에러 표준화 구현 (`withApiHandler`, `ApiError`, 표준 코드)
- PDF 분석 API
  - `POST /api/pdf/parse` 구현 (업로드, PDF 검증, 텍스트 추출, 정규화, pageMap 생성)
  - 대용량 대응 텍스트 청크 유틸 구현
  - `POST /api/summary` 구현 (직접 요약 + 청크 병합 요약)
  - `POST /api/toc` 구현 (직접 목차 + 청크 병합 목차)
  - 동일 제목 번호 부여 로직 구현 (`제목 (1)`, `제목 (2)`)
  - 분석 결과 `zod` 스키마 검증 적용
- 템플릿/슬라이드 생성
  - 테마별 HTML 템플릿 관리 구조 구현 (4개 테마 + 레지스트리)
  - 토큰 치환 규칙 구현 (`[SLIDE_CONTENTS_HERE]`, `[SLIDE_CSS_HERE]`)
  - `POST /api/slide/generate` 구현 (선택 목차 항목 단건 생성)
  - 생성 결과 HTML 유효성 검사 구현 (파싱 + 필수 블록 검사)
- 프론트엔드 단일 화면 UI
  - PDF 업로드 UI
  - 요약 생성 버튼 + 결과 패널
  - 목차 생성 버튼 + 목차 리스트
  - 테마 선택 UI
  - 스타일 선택 UI
  - 목차 단건 선택 UI
  - 슬라이드 미리보기 렌더러(iframe srcdoc)
  - 로딩/에러/재시도 UX
- 상태 관리
  - 전역 store 설계 완료 (`document`, `summary`, `toc`, `selectedItem`, `slide`)

## 아직 미구현/부분 구현 항목

- 생성 실패 자동 재시도 정책(백오프/최대 횟수) 미구현
- 평가 UI(좋아요/싫어요) 및 사유 UI 미구현
- `POST /api/slide/feedback` 미구현
- 사유 기반 재생성 프롬프트 보강 규칙 미구현
- 컨텍스트 재주입(Reset) 트리거 미구현
- `contextVersion` 중심 로깅/이력 고도화 미구현
- Export(HTML/SVG 다운로드, PNG export) 미구현
- 보안 강화(sanitize/CSP, rate limit/timeout 정책 등) 일부만 반영
- 테스트 코드(단위/통합/회귀) 미작성
- 헬스체크 `GET /api/health` 미구현

## 검증 상태

- 최근 `pnpm check` 반복 실행 기준: 오류/경고 0건

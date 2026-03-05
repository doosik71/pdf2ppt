# 코딩 에이전트 명령지시문

저장소를 초기화하고 기본 브랜치 전략(`main`, `dev`, feature branch)을 확정하라.

SvelteKit 프로젝트를 PNPM으로 생성하라.

Tailwind CSS를 설정하고 전역 스타일을 초기화하라.

필수 패키지(`zod`, PDF 파서, LLM SDK/클라이언트, 테스트 도구)를 설치하라.

`.gitignore`를 정리하고 `node_modules`, `.env`, 빌드 산출물을 제외하라.

`.env.sample`에 필수 환경변수 템플릿을 정의하라.

기본 스크립트(`dev`, `build`, `preview`, `test`, `lint`)를 점검하라.

디렉터리 구조(`src/routes`, `src/lib/server`, `src/lib/templates`, `src/lib/stores`)를 생성하라.

서버 전용 환경변수 로더를 `$env/static/private` 기반으로 구현하라.

LLM Provider 추상 인터페이스(`summarize`, `generateToc`, `generateSlide`)를 정의하라.

Gemini Adapter를 구현하라.

Ollama Adapter를 구현하라.

`DEFAULT_PROVIDER` 기반 Provider 선택 로직을 구현하라.

공통 API 에러 포맷과 에러 코드를 표준화하라.

`POST /api/pdf/parse`를 구현하여 PDF 업로드, 텍스트 추출, 정규화를 처리하라.

대용량 PDF 대응을 위한 텍스트 청크 분할 유틸리티를 구현하라.

`POST /api/summary`를 구현하여 핵심 요약과 키포인트를 생성하라.

`POST /api/toc`를 구현하여 슬라이드용 목차를 생성하라.

동일 제목 번호 부여 로직(예: `제목 (1)`, `제목 (2)`)을 구현하라.

분석 결과에 `zod` 스키마 검증을 적용하라.

업로드 영역 UI를 구현하라.

요약 생성 버튼과 결과 패널 UI를 구현하라.

목차 생성 버튼과 목차 리스트 UI를 구현하라.

테마 선택 UI를 구현하라.

스타일 선택 UI를 구현하라.

목차 항목 단건 선택 UI를 구현하라.

전역 상태 store(`document`, `summary`, `toc`, `selectedItem`, `slide`)를 설계하라.

로딩, 에러, 재시도 UX를 처리하라.

테마별 HTML 템플릿 관리 구조를 구현하라.

토큰 치환 규칙(`[SLIDE_CONTENTS_HERE]`, `[SLIDE_CSS_HERE]`)을 구현하라.

`POST /api/slide/generate`를 구현하여 선택 목차 항목 단건 슬라이드를 생성하라.

슬라이드 미리보기 렌더러를 구현하라.

생성 결과 유효성 검사(HTML 파싱, 필수 블록 존재 여부)를 구현하라.

생성 실패 시 재시도 정책(백오프, 최대 횟수)을 구현하라.

평가 UI(좋아요, 싫어요)를 구현하라.

싫어요 사유 UI(스타일 부적합, 내용 부적합, HTML 깨짐)를 구현하라.

`POST /api/slide/feedback`를 구현하라.

사유별 재생성 프롬프트 보강 규칙을 구현하라.

컨텍스트 재주입(Reset) 트리거를 구현하라.

`contextVersion` 관리와 로깅을 구현하라.

HTML(SVG 포함) 다운로드 기능을 구현하라.

PNG export 기능을 구현하라(클라이언트 캡처 우선).

Export 파일명 규칙(문서명, 목차, 타임스탬프)을 구현하라.

Export 결과 호환성(Chrome, Edge)을 점검하라.

클라이언트 번들의 민감 환경변수 노출 여부를 점검하라.

입력값 검증, 파일 크기 제한, 타입 제한을 적용하라.

sanitize/CSP를 적용하여 렌더링 보안을 강화하라.

API 타임아웃 및 레이트리밋 기본 정책을 적용하라.

구조화 로그와 요청 추적 ID를 적용하라.

`GET /api/health` 헬스체크 엔드포인트를 구현하라.

프롬프트 빌더 단위 테스트를 작성하라.

목차 번호 부여 로직 단위 테스트를 작성하라.

템플릿 토큰 치환 로직 단위 테스트를 작성하라.

업로드→요약→목차→슬라이드 생성 통합 테스트를 작성하라.

피드백 기반 재생성 통합 테스트를 작성하라.

HTML 형식 깨짐 검출 회귀 테스트를 작성하라.

테마/스타일 스냅샷 테스트를 작성하라.

`README.md`를 최신화하여 개발환경, 실행, 환경변수, 아키텍처를 반영하라.

API 명세 문서를 작성하라(요청, 응답, 에러코드).

운영 체크리스트를 작성하라(환경변수, 모니터링, 롤백).

배포 파이프라인을 구성하라(`build`, `preview`, 배포).

최종 릴리즈 노트를 작성하라(`v0.1.0` MVP).

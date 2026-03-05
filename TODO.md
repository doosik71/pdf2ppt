# PDF2PPT 개발 TODO

## Phase 0. 프로젝트 생성 및 초기 설정

- [ ] 저장소 초기화 및 기본 브랜치 전략 확정(`main`, `dev`, feature branch)
- [ ] SvelteKit 프로젝트 생성(PNPM 사용)
- [ ] Tailwind CSS 설정 및 전역 스타일 초기화
- [ ] 필수 패키지 설치(`zod`, PDF 파서, LLM SDK/클라이언트, 테스트 도구)
- [ ] `.gitignore` 정리(`node_modules`, `.env`, 빌드 산출물)
- [ ] `.env.sample`에 필수 환경변수 템플릿 정의
- [ ] 기본 스크립트 점검(`dev`, `build`, `preview`, `test`, `lint`)

## Phase 1. 기본 아키텍처 골격 구현

- [ ] 디렉터리 구조 생성(`src/routes`, `src/lib/server`, `src/lib/templates`, `src/lib/stores`)
- [ ] 서버 전용 환경변수 로더 구현(`$env/static/private` 사용)
- [ ] LLM Provider 추상 인터페이스 정의(`summarize`, `generateToc`, `generateSlide`)
- [ ] Gemini Adapter 구현
- [ ] Ollama Adapter 구현
- [ ] Provider 선택 로직 구현(`DEFAULT_PROVIDER`)
- [ ] 공통 API 에러 포맷/코드 표준화

## Phase 2. PDF 처리 및 문서 분석 기능

- [ ] `POST /api/pdf/parse` 구현(PDF 업로드/텍스트 추출/정규화)
- [ ] 대용량 PDF 대비 텍스트 청크 분할 유틸 구현
- [ ] `POST /api/summary` 구현(핵심 요약/키포인트)
- [ ] `POST /api/toc` 구현(슬라이드용 목차 생성)
- [ ] 동일 제목 번호 부여 로직 구현(예: `제목 (1)`, `제목 (2)`)
- [ ] 분석 결과 스키마 검증(zod) 적용

## Phase 3. 프론트엔드 단일 화면(SPA) 구현

- [ ] 업로드 영역 UI 구현
- [ ] 요약 생성 버튼/결과 패널 구현
- [ ] 목차 생성 버튼/목차 리스트 구현
- [ ] 테마 선택 UI 구현
- [ ] 스타일 선택 UI 구현
- [ ] 목차 항목 단건 선택 UI 구현
- [ ] 전역 상태(store) 설계(`document`, `summary`, `toc`, `selectedItem`, `slide`)
- [ ] 로딩/에러/재시도 UX 처리

## Phase 4. 슬라이드 생성 파이프라인

- [ ] HTML 템플릿 관리 구조 구현(테마별 템플릿)
- [ ] 토큰 치환 규칙 구현(`[SLIDE_CONTENTS_HERE]`, `[SLIDE_CSS_HERE]`)
- [ ] `POST /api/slide/generate` 구현(선택 목차 항목 단건 생성)
- [ ] 슬라이드 미리보기 렌더러 구현
- [ ] 생성 결과 유효성 검사(HTML 파싱/필수 블록 존재 여부)
- [ ] 생성 실패 시 재시도 정책 구현(백오프/최대 횟수)

## Phase 5. 피드백 기반 재생성 루프

- [ ] 평가 UI 구현(좋아요/싫어요)
- [ ] 싫어요 사유 UI 구현(스타일 부적합/내용 부적합/HTML 깨짐)
- [ ] `POST /api/slide/feedback` 구현
- [ ] 사유별 재생성 프롬프트 보강 규칙 구현
- [ ] 컨텍스트 재주입(Reset) 트리거 구현
- [ ] `contextVersion` 관리 및 로깅 구현

## Phase 6. Export 기능

- [ ] HTML(SVG 포함) 다운로드 기능 구현
- [ ] PNG export 구현(클라이언트 캡처 우선)
- [ ] Export 파일명 규칙 구현(문서명/목차/타임스탬프)
- [ ] Export 결과 호환성 점검(Chrome/Edge)

## Phase 7. 보안/운영 안정성

- [ ] 클라이언트 번들에 민감 환경변수 노출 여부 점검
- [ ] 입력값 검증/파일 크기 제한/타입 제한 적용
- [ ] sanitize/CSP 적용으로 렌더링 보안 강화
- [ ] API 타임아웃/레이트리밋 기본 정책 적용
- [ ] 구조화 로그 및 요청 추적 ID 적용
- [ ] 헬스체크 엔드포인트 구현(`GET /api/health`)

## Phase 8. 테스트 및 품질 보증

- [ ] 단위 테스트: 프롬프트 빌더
- [ ] 단위 테스트: 목차 번호 부여 로직
- [ ] 단위 테스트: 템플릿 토큰 치환 로직
- [ ] 통합 테스트: 업로드→요약→목차→슬라이드 생성
- [ ] 통합 테스트: 피드백 기반 재생성
- [ ] 회귀 테스트: HTML 형식 깨짐 검출
- [ ] 테마/스타일 스냅샷 테스트

## Phase 9. 문서화 및 배포 준비

- [ ] `README.md` 최신화(개발환경/실행/환경변수/아키텍처)
- [ ] API 명세 문서화(요청/응답/에러코드)
- [ ] 운영 체크리스트 작성(환경변수/모니터링/롤백)
- [ ] 배포 파이프라인 구성(build/preview/배포)
- [ ] 최종 릴리즈 노트 작성(v0.1.0 MVP)

## 우선순위(실행 순서)

1. Phase 0 ~ 1
2. Phase 2 ~ 4
3. Phase 5 ~ 6
4. Phase 7 ~ 9

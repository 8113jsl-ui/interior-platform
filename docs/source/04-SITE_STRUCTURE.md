---
title: "인테리어 서포터 — 사이트 전체 구조"
version: "v1.1"
date: "2026-09-13"
status: "현재 구현 기준 (as-built)"
---

# 인테리어 서포터 — 사이트 전체 구조

이 문서는 **지금 저장소에 구현된 것**을 한곳에 모은다. 화면 경로, 역할, 기능, 코드 폴더, 데이터, 인가, 파일·알림·감사까지 포함한다.

| 문서 | 역할 | 충돌 시 |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` | 기술·스키마·보안의 **최종 기준** | 이 문서보다 이긴다. 컬럼·격리 규칙은 여기만 따른다 |
| `SITE_DESIGN.md` | 화면·권한·용어의 기획 기준 | 용어와 권한 매트릭스는 여기를 따른다 |
| `SITE_STRUCTURE.md` (본 문서) | 구현된 경로·모듈·기능 지도 | 코드가 바뀌면 이 문서를 같이 고친다 |
| `AGENTS.md` | 코드 생성 시 예외 없는 규칙 | 구현 지시와 충돌하면 규칙을 지킨다 |

스키마를 바꾸려면 코드를 고치지 말고 먼저 `ARCHITECTURE.md` 5장 변경 이유를 보고한다.

앱 루트는 `web/`. 패키지 매니저는 pnpm, 프레임워크는 Next.js 16 (App Router), 언어는 TypeScript strict.

---

## 1. 서비스가 하는 일

인테리어·리모델링 **시공사(업체)** 가 고객별 **프로젝트** 를 만들고, 디자인·자재·현장 사진·일정·요청을 한곳에 올린다. 고객은 초대를 받은 프로젝트만 로그인 후 보고, 일반 댓글을 남긴다. 디자인·자재 **승인** 과 **확정 지시** 는 프로젝트마다 발급되는 **확정 코드** 를 입력한 고객만 할 수 있다. 스태프는 승인 상태를 대신 바꾸지 않는다.

한 줄: **업체가 한 번 올리면, 고객이 언제든 들어와 보고 기록으로 남기는 프로젝트 페이지.**

운영 주체는 넷이다.

| 주체 | 코드에서의 식별 | 하는 일 |
| --- | --- | --- |
| 플랫폼 운영자 | `users.is_platform_admin = true`. 업체 멤버십 없음 | 이 사이트 자체 운영. 업체 등록, 총관리자 초대, 업체 상태, 공통 템플릿, 전체 감사로그, 시스템 설정 |
| 업체 총관리자 | `memberships.role = company_admin` | 한 업체 안의 멤버·고객·프로젝트·템플릿·설정 |
| 프로젝트 관리자 (PM) | `memberships.role = project_manager` | 담당 프로젝트의 콘텐츠·초대·확정 코드·홈 편집 |
| 고객 | `project_access` 가 있는 계정. 업체 멤버십 없음 | 초대받은 프로젝트 열람·일반 댓글. 확정 코드 입력 후 승인·확정 지시 |

한 계정은 여러 업체에 서로 다른 역할로 속할 수 있다. 세션에는 역할을 싣지 않는다. 역할은 요청 경로의 `companySlug` 와 함께 매번 조회한다.

---

## 2. 로그인 후 목적지

`postLoginPath(userId)` (`web/src/lib/authz/index.ts`)

1. 쿠키 `invite_token` 이 있으면 `/invite/{token}`
2. `is_platform_admin` 이면 `/platform` — **업체 개설 화면으로 가지 않는다**
3. 활성 멤버십이 있으면 `/app/{companySlug}`
4. `project_access` 가 있으면 `/portal`
5. 없으면 `/onboarding/company` (일반 계정이 자기 업체를 개설)

`/onboarding/company` 에 플랫폼 운영자가 들어오면 `/platform` 으로 보낸다. 플랫폼 운영자가 온보딩 폼으로 업체를 만들면 본인이 총관리자가 되어 버리므로 차단한다.

정지된 업체(`companies.status = suspended`)의 스태프는 `/app/{slug}` 에 들어가지 못한다.

---

## 3. 사이트맵 — 구현된 모든 화면

인가 함수는 페이지(또는 레이아웃) 첫 줄에서 호출한다. `proxy.ts` 는 세션 쿠키 유무와 화이트라벨 호스트만 본다. **보안 판정이 아니다.** 역할·멤버십·`project_access`·이메일 인증은 보지 않는다. `/api/*` 도 쿠키 유무로 막지 않는다.

`requireCustomerSession()` 은 `requireSession()` 과 같다. 고객 역할인지 검사하지 않는다. 스태프가 `/portal` 레이아웃까지는 들어올 수 있고, 프로젝트 화면은 `requireProjectAccess` 가 막는다.

구현된 `page.tsx` 는 50개, API `route.ts` 는 11개. `loading.tsx` 와 병렬 라우트 `default.tsx` 는 없다.

### 3.1 마케팅 (비로그인 공개)

레이아웃: `web/src/app/(marketing)/layout.tsx` — 상단 홈·요금제·로그인/로그아웃.

| URL | 파일 | 기능 |
| --- | --- | --- |
| `/` | `(marketing)/page.tsx` | 랜딩. 문제·기능·신뢰 문구와 가입/요금제 CTA |
| `/pricing` | `(marketing)/pricing/page.tsx` | 요금제 비교표. 지금은 전 기능 무료 안내 (`plan_enforcement_enabled=false`) |
| `/signup` | `(marketing)/signup/page.tsx` | 이름·이메일·비밀번호, 약관·국외이전 각각 동의. 가입 후 이메일 인증 |
| `/login` | `(marketing)/login/page.tsx` | 이메일·비밀번호. 성공 시 위 2장 경로로 이동 |
| `/verify-email` | `(marketing)/verify-email/page.tsx` | 인증 메일 안내. 이미 인증된 세션이면 `postLoginPath()` 로 보냄 |
| `/forgot-password` | `(marketing)/forgot-password/page.tsx` | 재설정 메일 요청 |
| `/reset-password` | `(marketing)/reset-password/page.tsx` | `?token=` 으로 새 비밀번호 |
| `/terms` | `(marketing)/terms/page.tsx` | 이용약관. `legalDraft` 초안 배너 |
| `/privacy` | `(marketing)/privacy/page.tsx` | 개인정보 처리방침. 국외 이전 표(Vercel, Neon, R2, Resend) |
| `/contact` | `(marketing)/contact/page.tsx` | 문의 폼. 액션은 `requirePublicContact()` (IP 레이트리밋) |

### 3.2 계정 전환

| URL | 가드 | 기능 |
| --- | --- | --- |
| `/onboarding/company` | 로그인. 플랫폼 운영자는 `/platform` | 업체명·사업자 형태. 개설자는 `company_admin` + `project_manager` 를 함께 받는다. free 구독 행을 만든다 |
| `/invite/[token]` | 없음(토큰). 미로그인 시 가입/로그인으로 | `company_member` 또는 `project_customer` 수락. 멤버 초대는 초대장 이메일과 수락 이메일이 같아야 한다. 고객 초대는 이메일을 묶지 않는다 |

### 3.3 플랫폼 운영자 `/platform/*`

레이아웃: `requirePlatformAdmin("플랫폼 콘솔 접근")`. 운영자는 업체 구성원이 되지 않는다.

| URL | 가드 | 기능 |
| --- | --- | --- |
| `/platform` | 플랫폼 | `/platform/companies` 로 리다이렉트 |
| `/platform/companies` | 플랫폼 | 전체 업체 목록(상태·요금제·용량·생성일). **업체 등록** — 이름·형태·총관리자 이메일. 등록 시 운영자 멤버십은 만들지 않고 총관리자 초대를 보낸다 |
| `/platform/companies/[companyId]` | 플랫폼 | 업체 상태(활성/연체/정지), 구성원 초대(총관리자·PM), PM 부여·회수, 비활성화 |
| `/platform/templates` | 플랫폼 | `scope=platform` 공통 템플릿 등록 |
| `/platform/audit-log` | 플랫폼 | 업체 경계를 넘는 전체 감사로그. 이 조회 자체도 `cross_tenant_query` 로 남는다 |
| `/platform/settings` | 플랫폼 | `platform_settings` JSON 편집 |
| `/platform/billing` | 플랫폼 | 안내만. 결제 연동 없음 (`billingIdle`) |

### 3.4 업체 내부 `/app/[companySlug]/*`

레이아웃: `requireCompanyStaff(companySlug)`. 헤더에 업체명, 프로젝트 목록, 대시보드, 로그아웃.

`/app/[companySlug]` → `/app/[companySlug]/admin`.

#### 관리 콘솔 `/admin/*`

사이드바: 스태프 공통(대시보드·고객·프로젝트·알림) + 총관리자만(멤버·설정·감사로그·템플릿·저장공간).

| URL | 가드 | 기능 |
| --- | --- | --- |
| `/app/{slug}/admin` | 스태프 | 대시보드 — 프로젝트 현황·공정 분포·최근 활동 |
| `/app/{slug}/admin/customers` | 스태프 | 고객(시공 의뢰인 카드) 등록·수정. 계정(`users`)과 다른 엔터티다 |
| `/app/{slug}/admin/projects` | 스태프 | 전체 프로젝트 목록·생성. PM 은 본인 담당만 목록에 나온다 |
| `/app/{slug}/admin/notifications` | 스태프 | **로그인한 본인**의 인앱/이메일 수신 on-off |
| `/app/{slug}/admin/members` | 총관리자 | 이메일 초대, PM 부여·회수, 비활성화. 마지막 총관리자는 회수 불가 |
| `/app/{slug}/admin/settings` | 총관리자 | 업체명·브랜드 색·로고 |
| `/app/{slug}/admin/audit-log` | 총관리자 | 이 업체 범위 감사로그 |
| `/app/{slug}/admin/templates` | 총관리자 | 업체 공통 템플릿, PM 승격 제안 승인·반려 |
| `/app/{slug}/admin/storage` | 총관리자 | 사용량 집계. 용량 차단·경고 메일은 하지 않는다 |

#### 프로젝트 목록

| URL | 가드 | 기능 |
| --- | --- | --- |
| `/app/{slug}/projects` | 스태프 | 프로젝트 목록. 총관리자는 전체, PM 은 담당만 |
| `/app/{slug}/projects/new` | 스태프 | 고객 선택, 제목·주소·일자, PM 배정(총관리자만 다른 PM 지정) |

#### 프로젝트 워크스페이스 `/projects/[projectId]/*`

레이아웃: `requireProjectInCompany` — 업체 일치 + (총관리자 또는 담당 PM). 탭: 개요, 홈 편집, 디자인, 자재, 요청사항, 진행 사진, 일정, 참여자, 프로젝트 설정.

| URL | 기능 |
| --- | --- |
| `.../overview` | 담당자, 현재 공정, 다음 일정, 최근 활동 |
| `.../home-editor` | 고객 홈 CMS. 블록 드래그·복제·숨김·저장, 템플릿 저장·적용·승격 제안. `?preview=1` 이면 고객 화면 미리보기 |
| `.../designs` | 디자인 버전 등록, 파일, 공개 상태, 고객 승인 결과 표시 |
| `.../materials` | 공간(7종)별 자재, 링크 미리보기, 구매 상태(견적→완료), 공개 상태 |
| `.../requests` | 댓글 작성·본인 수정·스태프 삭제. 확정 지시는 수정·삭제 불가 |
| `.../photos` | 공정(11종)별 업로드, 일괄 검토/공개, Before/After 짝 |
| `.../schedule` | 월/목록, 공정·방문·확정 일정, 공개 상태 |
| `.../access` | 고객 초대 링크, 참여자 라벨·회수, 확정 코드 발급(평문 1회) |
| `.../settings` | 제목·주소·일자·공정·보관 |

### 3.5 고객 포털 `/portal/*`

레이아웃: 로그인 고객. 헤더에 홈·알림·내 계정·로그아웃.

프로젝트 레이아웃: `requireProjectAccess` — `project_access` 가 있고 업체가 정지가 아닐 것. 탭: 홈, 디자인, 자재, 진행 사진, 일정, 요청사항. **공개(`published`) 콘텐츠만** 보인다.

| URL | 가드 | 기능 |
| --- | --- | --- |
| `/portal` | 로그인 고객 | 초대받은 프로젝트 목록 |
| `/portal/me` | 로그인 고객 | 이름·연락처·비밀번호, 알림 수신 |
| `/portal/{id}` | 접근 | `/home` 으로 보냄 |
| `/portal/{id}/home` | 접근 | PM 이 짠 홈 블록 |
| `/portal/{id}/design` | 접근. 승인은 확정 검증 | 최신 공개 버전, 승인/반려 |
| `/portal/{id}/materials` | 동일 | 공간별 공개 자재, 승인/반려 |
| `/portal/{id}/photos` | 접근 | 공정별 공개 사진, 라이트박스 |
| `/portal/{id}/schedule` | 접근 | 공개 일정 |
| `/portal/{id}/requests` | 접근. 확정 지시는 확정 검증 | 일반 댓글, 본인 수정. 확정 지시는 수정 불가 |
| `/portal/{id}/verify` | 접근 | 확정 코드 입력. 성공 시 `project_verifications` |

### 3.6 시스템 화면

| URL | 의미 |
| --- | --- |
| `unauthorized` | 로그인 필요 |
| `forbidden` | 권한 없음 |
| `not-found` | 없음 |
| `error` / `global-error` | 처리 실패. 오류 번호 표시 |

`experimental.authInterrupts: true` 가 있어야 `forbidden()` / `unauthorized()` 가 동작한다.

### 3.7 API

| 경로 | 역할 |
| --- | --- |
| `/api/auth/[...all]` | Better Auth. `src/lib/auth` 밖에서 better-auth 를 import 하지 않는다 |
| `/api/files/[objectId]?v=thumb\|full` | 세션 + `file_proxy` 레이트리밋 후 중계. 서명 URL 을 밖으로 내지 않는다. `next/image` 는 `unoptimized` + 이 경로만 쓴다. 고객은 연결된 콘텐츠가 `published` 일 때만 |
| `/api/uploads/sign` | 스태프 컨텍스트. 브랜드 로고는 총관리자만. Content-Type·Content-Length 조건 서명 |
| `/api/uploads/complete` | 매직바이트 검사, 썸네일, `storage_used_mb` 집계, `status=ready` |
| `/api/uploads/local/[objectId]` | 로컬 디스크 PUT. 스토리지가 로컬이 아니면 404 |
| `/api/link-preview` | PM/담당 스태프. `link_preview` 레이트리밋. 사설 IP 차단, 이미지는 `_link/` 키로 복사 |
| `/api/cron/*` | `cron-secret` 헤더 또는 `Authorization: Bearer`. GET·POST. publish-scheduled / notification-retry / retention / storage-recalc |
| `/api/health` | `platform_settings` 와 스토리지 `head("_health")` |

---

## 4. 기능 명세

### 4.1 계정

- 가입: 비밀번호 10자 이상, 약관·국외이전 각각 체크, 이메일 인증.
- 로그인 실패 메시지는 계정 존재 여부를 말하지 않는다. 감사에는 이메일 해시만.
- 비밀번호 변경·재설정 후 그 계정 세션을 전부 폐기한다.
- 로그아웃은 `signOutAction` — 감사 `logout` 후 `/login`.
- 소셜 로그인 없음.

### 4.2 업체

**직원이 개설:** 온보딩. 개설자 = 총관리자 + PM. 상태 `active`, 요금제 `free`.

**운영자가 등록:** 플랫폼 콘솔. 운영자는 멤버가 되지 않는다. 총관리자 이메일로 `company_member` 초대를 보낸다. 수락해야 권한이 생긴다. 이후 상세에서 PM·총관리자를 더 초대하거나 회수한다.

상태: `active` → `past_due` → `suspended`. 정지는 스태프 `/app` 차단, 데이터는 남긴다. 체험(trial) 상태는 없다.

### 4.3 멤버십

- 초대 종류 `company_member` / `project_customer`.
- 멤버 초대: 이메일 일치 필수. 만료일은 `platform_settings.invite_expire_days`.
- 총관리자는 PM 을 개별로 켜고 끈다. 마지막 총관리자 회수 금지.
- 비활성화 시 그 업체의 멤버십을 끄고 세션을 지운다.

### 4.4 고객 카드 vs 고객 계정

| | `customers` | `users` + `project_access` |
| --- | --- | --- |
| 의미 | 업체가 관리하는 시공 의뢰인 기록 | 포털에 로그인하는 사람 |
| 만드는 곳 | `/admin/customers` | 회원가입 + `/access` 초대 수락 |
| 관계 | 프로젝트 `customer_id` (1:N) | 프로젝트당 여러 계정(부부·가족) |

### 4.5 프로젝트

- 제목, 주소, 계약·착공·준공일, 현재 공정, 상태(`active`/`paused`/`done`/`archived`), 담당 PM.
- 소프트 삭제 `deleted_at`.
- 확정 코드: 해시만 저장, 평문은 발급 직후 1회. 재발급 시 `code_version` 증가, 기존 `project_verifications` 전부 무효.

### 4.6 공개 상태

모든 고객 노출 콘텐츠: `draft` → `review` → (`scheduled`) → `published`.

허용 전이 (`lib/visibility.ts`):

- draft → review
- review → draft, scheduled, published
- scheduled → published, review
- published → review

고객 화면은 `published` 만. 예약 공개는 크론 `publish-scheduled`.

### 4.7 디자인

버전 번호·이름·파일·미리보기·변경 메모·공개·승인. 새 공개 버전이 고객 최신이 된다. 이전 버전은 남긴다. 승인자(`approved_by`)는 확정 검증을 통과한 고객의 `userId` 만.

### 4.8 자재

공간 7종: 거실, 주방, 욕실, 침실, 조명, 가구, 가전.

구매: 견적 → 주문 → 배송 → 설치 → 완료. 이력은 `material_status_history`. 되돌릴 때 메모 필수.

외부 URL 은 미리보기 후 제목·사이트명·이미지를 우리 쪽에 보관한다.

### 4.9 진행 사진

공정 11종: 철거, 전기, 목공, 타일, 필름, 마루, 도기셋팅, 도배, 가구, 조명설치, 마감.

`pair_group_id` + `pair_role` (`before`/`after`) 로 짝을 만든다. 홈 Before & After 블록은 둘 다 공개여야 보인다.

### 4.10 일정

종류: 공정(`process`), 방문(`visit`), 확정(`confirmed`). 입력 문자열은 `lib/datetime.parseSeoulInput()` 만 쓴다. `new Date(사용자입력)` 금지. 표시는 Asia/Seoul.

### 4.11 댓글

| | 일반 `normal` | 확정 지시 `binding` |
| --- | --- | --- |
| 작성 | 접근 있는 고객, 스태프 | 확정 검증된 고객만 |
| 수정 | 작성자 본인만 | 본인도 불가 |
| 삭제 | 스태프만 | 불가 |
| 감사 | 수정·삭제 | 본문을 그대로 남긴다 |

### 4.12 고객 홈 CMS

프로젝트당 `pages` 1장. 블록 10종:

| type | 내용 |
| --- | --- |
| `text` | HTML 텍스트(편집기) |
| `gallery` | 이미지 |
| `before_after` | 짝 사진 |
| `design_file` | 디자인 버전 연결 |
| `material_card` | 자재 연결 |
| `schedule` | 일정 |
| `comment` | 댓글·새 글 허용 여부 |
| `process` | 공정 사진 묶음 |
| `button` | 외부 링크 또는 승인 화면 이동 |
| `divider` | 여백 |

템플릿 `scope`: `platform` (전 업체 읽기 전용) / `company` / `project`. 승격 시 원본을 두고 `company` 사본을 만든다.

### 4.13 파일

- 버킷(또는 로컬 `.local-storage`)은 비공개.
- 업로드: sign → PUT → complete. 매직바이트·크기 검사.
- 흐름: `Uploader` → `POST /api/uploads/sign` (`storage_objects` pending) → presigned PUT 또는 로컬 PUT → `POST /api/uploads/complete` (매직바이트, sharp 썸네일, ready).
- 조회: `/api/files/{id}`. 권한은 세션 + 업체/프로젝트 접근. 고객은 published 연결만.
- `FileImage` 는 `unoptimized`. Next 이미지 최적화기가 쿠키 없이 `/api/files` 를 치면 401 JSON 이 되어 깨진다.
- 홈 저장(`saveHomeBlocks`)은 본인 화면을 바로 갱신하려고 `updateTag` 를 쓴다.

### 4.14 알림

채널: 인앱, 이메일(Resend). 카카오 알림톡·SMS 는 빈 구현체만.

수신 설정은 **본인 계정** 단위. 누가 어떤 이벤트를 받는지는 서비스 정책.

### 4.15 감사

가입/로그인/실패/인증/비번재설정, 멤버 초대·역할·비활성, 프로젝트 접근 허용·회수, 확정 코드 발급·검증 성공·실패, 공개 변경, 승인/반려, 확정 지시, 파일 업·삭제, 댓글 수정·삭제, 템플릿 제안·승인·반려, 업체 생성·상태, 테넌트 초월 조회.

같은 트랜잭션 안에서 `recordAudit`. `before`/`after` 에 연락처·주소 원문 금지. 확정 지시만 본문 허용.

### 4.16 요금제·결제

테이블 `subscriptions`, `invoices` 는 있다. 결제 SDK 호출은 없다. `plan_enforcement_enabled=false` 이면 한도 검사는 항상 통과한다. 저장용량은 집계만 한다.

---

## 5. 코드 구조

```
인테리어-서포터/
├── SITE_STRUCTURE.md         본 문서 (구현 지도)
├── SITE_DESIGN.md            화면·권한·용어
├── AGENTS.md                 코드 생성 헌법
├── docs/
│   ├── ARCHITECTURE.md       기술·스키마 최종 기준
│   ├── PROMPTS.md
│   └── RUNBOOK_PRIVACY.md
└── web/                      Next.js 앱
    ├── src/app/              화면·API 조립만
    ├── src/modules/          도메인 (index → actions → service → repo → schema)
    ├── src/lib/              인증·DB·스토리지·알림·메시지
    ├── src/components/       UI
    ├── src/proxy.ts          UX 리다이렉트만
    ├── drizzle/              마이그레이션
    ├── scripts/              seed, migrate, selfcheck
    └── tests/                unit / integration / e2e
```

### 5.1 계층과 의존 방향

```
proxy.ts (쿠키·호스트)
    ↓
app/*  페이지·레이아웃     ← modules/*/index.ts 만 import
    ↓
modules/*/actions.ts       첫 줄 requireXxx
    ↓
lib/authz                  멤버십 조회로 DataContext 생성
    ↓
modules/*/service.ts       Zod, 정책, 트랜잭션, recordAudit
    ↓
modules/*/repo.ts          첫 인자 DataContext. 직접 Drizzle
    ↓
lib/db                     modules/*/repo 밖에서 import 금지
```

벤더 격리:

| 패키지 | 허용 위치 |
| --- | --- |
| `better-auth` | `src/lib/auth` |
| `@aws-sdk/*` | `src/lib/storage` |
| `resend` | `src/lib/notify` |
| 결제 SDK | `src/lib/payments` (비어 있음) |
| DB 클라이언트 | `src/lib/db` → `modules/*/repo.ts` 만 |

### 5.2 모듈 목록

각 모듈은 보통 `schema.ts`, `repo.ts`, `service.ts`, `actions.ts`, `policy.ts`, `dto.ts`, `index.ts`.

| 모듈 | 테이블 | 하는 일 |
| --- | --- | --- |
| `membership` | users, sessions, accounts, verifications, memberships, invitations | 가입·세션·멤버·초대 |
| `company` | companies, platform_settings | 업체 CRUD, 플랫폼 설정, 상태 |
| `customer` | customers | 업체 고객 카드 |
| `project` | projects | 프로젝트 |
| `access` | project_access, project_verifications | 고객 접근, 확정 코드 |
| `page-builder` | pages, blocks, templates | 홈 CMS, 템플릿 |
| `design` | design_versions | 디자인 버전·승인 |
| `material` | materials, material_status_history | 자재·구매 |
| `photo` | progress_photos | 현장 사진 |
| `schedule` | schedules | 일정 |
| `comment` | comments | 댓글·확정 지시 |
| `storage-quota` | storage_objects | 파일 메타·중계·용량 합 |
| `notification` | notifications, notification_preferences | 알림·수신 설정 |
| `audit` | audit_logs | 감사 |
| `billing` | subscriptions, invoices | 스키마만. 결제 없음 |

### 5.3 `src/lib`

| 경로 | 역할 |
| --- | --- |
| `auth/` | 세션 `userId, email, name, emailVerified, isPlatformAdmin`. 역할 없음 |
| `authz/` | `requirePlatformAdmin`, `requireCompanyStaff`, `requireCompanyAdmin`, `requireProjectInCompany`, `postLoginPath` |
| `authz/portal.ts` | `requireProjectAccess`, `requireProjectVerified` |
| `tenancy/context.ts` | `DataContext` 4종, `scoped`, `assertSameTenant`, `assertSameProject` |
| `tenancy/platform.ts` | 사유 필수 + `cross_tenant_query` 감사 |
| `tenancy/system.ts` | 배치 전용. 허용 job: `invite-accept`, `invite-token`, `portal-access`, `portal-list`, `notify-dispatch`, `publish-scheduled`, `retention`, `storage-recalc`, `notification-prefs`, `post-login` |
| `config/hosts.ts` | `resolvePortalHost()` — 지금은 항상 `null`. 화이트라벨 라우팅은 꺼져 있다 |
| `db/` | Drizzle, enums |
| `storage/` | R2 또는 로컬 |
| `notify/` | 메일·인앱. 알림톡/SMS 스텁 |
| `payments/` | 빈 자리 |
| `messages/` | 사용자 한글 문자열·enum 라벨. 화면 영문 원문 금지 |
| `datetime.ts` | `parseSeoulInput`, `formatSeoul` |
| `visibility.ts` | 공개 전이 |
| `cursor/` | `(created_at, id)` 커서. OFFSET 금지 |
| `ratelimit/` | `platform_settings` 수치 |
| `ssrf.ts` | 링크 미리보기 사설 IP 차단 |
| `cron.ts` / `cron-jobs.ts` | 크론 본문 |

`staff` 컨텍스트는 `requireXxx` / `loadXxx` 가 멤버십을 읽어 만든 것만 유효하다. 예외는 업체 개설 부트스트랩 트랜잭션뿐.

### 5.4 컴포넌트

| 그룹 | 예 | 역할 |
| --- | --- | --- |
| `auth-*` | AuthShell, auth-forms, logout-button | 가입·로그인·업체 개설 |
| `portal/` | FileImage, PortalNav, InboxBell, VerifyForm, Lightbox, InvitePanel, IssueCode | 고객·참여자 |
| `page-builder/` | editor, home-renderer, text-html-editor | 홈 CMS |
| `shared/` | Uploader, VisibilityControl, LoadMore, LinkPreviewField | 스태프 공통 |
| `ui/` | shadcn 계열 | 원시 컨트롤 |

서버 컴포넌트가 기본. 상호작용만 `'use client'`. 클라이언트는 `modules/*/index` 배럴이 아니라 `modules/*/actions` 의 `"use server"` 를 직접 import 한다. 배럴을 가져오면 DB 클라이언트가 브라우저 번들에 들어간다.

### 5.5 Next.js 16에서 이 저장소가 지키는 것

- 진입점은 `proxy.ts` 의 `proxy`. `middleware.ts` 없음.
- `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` 는 Promise. 반드시 await.
- `revalidateTag` 는 cacheLife 인자 필수. 본인 변경을 바로 보려면 `updateTag`.
- `images.remotePatterns` 사용. 스토리지 도메인은 넣지 않는다.
- lint 는 eslint CLI. `next lint` 없음.

---

## 6. 데이터 모델 (구현 테이블)

키는 uuid. 시각은 timestamptz UTC 저장, 화면 Asia/Seoul. 테넌트 행은 `company_id NOT NULL` (예외: users, platform scope templates, 일부 audit).

컬럼의 **유일한 출처**는 `ARCHITECTURE.md` 5장이다. 아래는 구현 목록이다.

| 테이블 | 핵심 컬럼 | 비고 |
| --- | --- | --- |
| `users` | email, name, email_verified, is_platform_admin, is_active, phone | 비밀번호는 Better Auth 쪽 |
| `sessions` / `accounts` / `verifications` | 인증 모듈 | |
| `memberships` | user_id, company_id, role, is_active, granted_by | 유니크 (user, company, role) |
| `invitations` | kind, company_id, project_id?, role?, email?, token, expires_at | |
| `companies` | name, slug, status, plan_tier, brand_*, storage_*mb, created_by | |
| `platform_settings` | key, value(json) | 한도·만료·레이트리밋. 코드 상수로 박지 않음 |
| `customers` | name, phone, email, memo | 소프트 삭제 |
| `projects` | customer_id, manager_id, title, dates, current_process, status, verification_code_hash, code_version | 소프트 삭제 |
| `project_access` | project_id, user_id, label, granted_by, revoked_at | |
| `project_verifications` | project_id, user_id, code_version | 세대가 다르면 무효 |
| `pages` | project_id, title | 프로젝트당 1 |
| `blocks` | page_id, block_type, layout, content, visibility_status, publish_at | 소프트 삭제 |
| `templates` | scope, company_id?, project_id?, blocks_snapshot, promotion_* | |
| `design_versions` | version_no, files, approval_*, visibility_* | |
| `materials` | space_category, spec, purchase_status, approval_*, visibility_*, link_* | |
| `material_status_history` | from/to, note | |
| `progress_photos` | process_category, pair_*, visibility_* | |
| `schedules` | type, start_at, visibility_* | |
| `comments` | kind, body, edit_history, deleted_at | |
| `storage_objects` | object_key, thumb_key, category, status, byte_size | |
| `notifications` | event_type, channel, dedupe_key, read_at | |
| `notification_preferences` | user_id, event_type, inapp/email | |
| `audit_logs` | actor_*, action_type, target_*, before/after | |
| `subscriptions` / `invoices` | 구독·청구 | 결제 로직 없음 |
| 레이트리밋 테이블 | `lib/ratelimit/schema` | |

목록은 `(created_at, id)` 커서. `OFFSET` 금지.

소프트 삭제 조회에는 `isNull(deletedAt)` 필수.

---

## 7. 격리와 인가

격리는 **두 축**이다.

1. **업체 축** — 쿼리에 `company_id` (또는 `scoped`). 읽은 행에 `assertSameTenant(ctx, row)`.
2. **프로젝트 축 (I11)** — `project_id` 가 있는 테이블은 `projectScoped` + `assertSameProject`. 업체만 검사하면 같은 업체 다른 프로젝트가 통과한다.
3. **담당 (I12)** — 리소스 id 만 받는 스태프 함수는 행을 읽은 직후 `assertStaffOwnsProject`. 총관리자는 통과, PM 단독은 본인 담당만.

`DataContext`:

```
staff     { companyId, userId, roles }
customer  { companyId, projectId, userId, verified }
platform  { userId, reason }     // 사유·감사 필수
system    { job }                // 배치 4곳만
```

플랫폼이 특정 업체를 다룰 때는 `company_id` 를 인자로 명시한다. `scoped(platform)` 은 필터가 없으므로, 필터 없는 `countActiveAdmins` 같은 함수를 플랫폼에 재사용하면 전 업체 합계가 나온다. 플랫폼 멤버 관리는 `*In(ctx, companyId)` 계열을 쓴다.

작성자·승인자는 세션 `userId` 로만 채운다.

---

## 8. 화면 권한 요약

| 행위 | 플랫폼 | 총관리자 | PM | 고객 |
| --- | --- | --- | --- | --- |
| 업체 등록·정지 | O | - | - | - |
| 업체에 총관리자/PM 초대 | O (콘솔) | O | - | - |
| 플랫폼 템플릿 | O | - | - | - |
| 전체 감사로그 | O | - | - | - |
| 업체 멤버·설정·업체 감사·용량 | - | O | - | - |
| 고객 카드·프로젝트 생성 | - | O | O (담당) | - |
| 홈 편집·콘텐츠 공개 | - | △(PM 권한 있으면) | O 담당 | - |
| 디자인/자재 승인·확정 지시 | - | - | - | O (확정 코드) |
| `/app` 진입 | - | O | O | 불가 |
| `/portal` 해당 프로젝트 | - | - | - | 초대된 것만 |
| `/platform` | O | - | - | - |

---

## 9. UI

토큰은 `web/src/app/globals.css`. 아이보리 배경, 페이퍼 카드, 금색 버튼, 브라운 본문. 검정 헤더를 쓰지 않는다.

| 클래스 | 용도 |
| --- | --- |
| `.ink-btn` | 주요 동작 (금색 채움) |
| `.ghost-btn` / `.ghost-btn-sm` | 보조 |
| `.nav-btn` / `.nav-btn-active` | 탭·필터 |
| `.danger-btn` | 삭제·회수·보관 |
| `.text-link` | 약관·테이블 제목 등 문서성 링크 |
| `.field` | 입력 |
| `.paper-card` / `.atelier-bar` / `.gold-label` | 카드·헤더·라벨 |

한글은 맑은 고딕, 자간 확장 없음, `word-break: keep-all`. 사용자 문자열은 `src/lib/messages`.

---

## 10. 의도적으로 없는 것

- 결제 연동, 요금제 강제 (스위치만 있음)
- 저장공간 차단·용량 경고 메일 (집계만)
- 카카오 알림톡/SMS 실제 발송
- 소셜 로그인
- 화이트라벨 도메인 운영 (`companies.custom_domain` 컬럼과 `proxy.ts` 분기만. `resolvePortalHost()` 가 `null` 이라 동작하지 않음)
- `ARCHITECTURE.md` 3.1 에 없는 런타임 패키지 임의 추가

---

## 11. 로컬·검증

앱 디렉터리 `web/`.

| 명령 | 용도 |
| --- | --- |
| `pnpm dev` | 개발 서버 (기본 :3000) |
| `pnpm db:migrate` / `pnpm db:seed` | 마이그레이션·시드 |
| `pnpm typecheck` / `pnpm lint` | 타입·eslint |
| `pnpm test:unit` / `test:integration` / `test:e2e` | 테스트 |
| `pnpm selfcheck` | 저장소 점검 |

환경변수는 `web/.env.local`. 시드는 목업 업체·계정을 만든다. 운영 DB 의 통합테스트 잔여 행과 목업을 혼동하지 말 것.

날짜 입력은 반드시 `parseSeoulInput`. 서버 UTC 에서 `new Date("YYYY-MM-DD")` 는 하루가 밀린다.

목록 N+1 금지. 선조회도 필요 없으면 하지 않는다.

---

## 12. 핵심 사용자 흐름

```
[누구나] 가입 → 이메일 인증 → 로그인
    ├─ 플랫폼 운영자 ─────────────── /platform 에서 업체 등록·총관리자 초대
    ├─ 업체 없음 ─────────────────── /onboarding/company 로 자기 업체 개설
    └─ 멤버/고객 ─────────────────── 초대 링크 수락

[총관리자] 멤버 초대 → 고객 카드 → 프로젝트 생성 → PM 배정
[PM] 홈 편집 · 디자인/자재/사진/일정 등록 → 공개 → 고객 초대 · 확정 코드 전달
[고객] 초대 수락 → 포털 열람·댓글 → (결정권자) 확정 코드 → 승인/확정 지시
```

모든 공개·승인·삭제는 감사 로그에 남고, 고객이 보는 것은 공개된 것만이다.

---

## 13. 용어

| 용어 | 의미 |
| --- | --- |
| 업체 | 구독 시공사 한 곳. `companies`. URL `companySlug` |
| 프로젝트 | 한 시공 건. 콘텐츠의 귀속 단위 |
| 블록 | 고객 홈 CMS 최소 단위 |
| 공개 상태 | draft / review / scheduled / published |
| 확정 코드 | 프로젝트당 하나. 해시 저장, 재발급 시 기존 확정 무효 |
| 프로젝트 접근 | 고객 계정이 그 프로젝트를 볼 수 있는 권한 |
| 멤버십 | 계정이 업체에서 갖는 역할 |
| 고객 카드 | `customers` 행. 로그인 계정과 다름 |
| 확정 지시 | `comments.kind = binding`. 수정·삭제 불가 |

이 문서를 고칠 때: 경로·모듈·테이블이 코드와 다르면 코드를 우선 확인하고 여기를 맞춘다. 스키마를 코드에서 먼저 바꾸지 않는다.

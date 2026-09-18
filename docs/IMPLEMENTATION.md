# Full stack implementation plan

User approval: implement the entire briefing, preserve the 8766 clone design, provide database/deployment credentials later. Existing artifacts remain untouched.

Architecture: identical reference landing at `/`, application at `/app/`; Node 24+ server, SQLite for local operation, PostgreSQL via DATABASE_URL for hosted operation. Private files stored locally on a persistent volume or in configured Supabase Storage. Server sessions and per-request authorization; no client role switch grants access. No external deployment without credentials. Use subagent-driven-development for independent frontend and deployment work, with backend implemented locally and subsequent review.

- [x] Server authentication, transactional database repository, tenant/project permissions and concurrency tests.
- [x] Frontend API integration, login/invite screens, participant/settings UI, field photos, approvals, notifications.
- [x] Preserve original landing appearance/motion and connect entry points to app.
- [x] Deployment configuration, backup/restore commands, environment examples and documentation.
- [x] Integration/security tests, browser verification, review and package.

Ruling: pending policy modules exist but default off; specifically authorized company owner can enable policy switches in settings. This does not grant all PMs administrative privileges.
Ruling: credentials not provided means actual hosted PostgreSQL/Storage and deployment remain unverified, not simulated as success.
Ruling: local signup is replaced by a one-time bootstrap CLI and one-time invitations. No administrator web portal is created.

## API contract

All API JSON errors `{error: code, message}`. Cookie session, same-origin writes enforced; JSON only. GET /api/session -> `{user:null}` or `{user:{id,name,email,role},prefs:{lang,logo},companies:[{id,title,policies:{participants:false,approvals:false},canManage:boolean}]}`.
POST /api/login `{email,password}` -> session response. POST /api/logout. POST /api/accept-invite `{token,name,password}` -> session response; existing accounts must authenticate before redeeming. GET /api/invite?token= -> `{email,role,company,expiresAt}`.
GET /api/state -> `{projects:[],items:[],clients:[],history:[],notifications:[],assignments:[],members:[],companies:[]}`. Records include `id,company,version`; all use existing frontend shapes. Assignments have `id,company,project,user,role,from,until,revoked,canConfirm`. Members returned only for company managers.
POST /api/changes `{changes:[{collection:'projects'|'items'|'clients',id,baseVersion:0,data:{...}}]}` -> full filtered state; updates require version match. Omission is not deletion. Server creates all audit/notification/uploader/time values. Data URIs in `data`, `materialImage`, `previews[].data` are validated and replaced with private /api/files/{id} URLs. Max file 20MB. GET files rechecks authorization. `archived:true` via normal change (PM only); old files preserved, no physical delete UI.
PUT /api/preferences `{lang,logo}` -> `{prefs}`; PNG logo <=1MB.
POST /api/invitations `{company,project,email,role:'pm'|'customer'|'field',from,until,canConfirm}` -> `{url,expiresAt}`. Manager + participants policy required. No email automatically sent. POST /api/assignments `{company,project,user,from,until,canConfirm,revoked}` -> state; role derived from target user.
PUT /api/company `{id,title,policies:{participants,approvals},template}` -> state (owner only). Pending modules only enabled by explicit setting.
POST /api/confirm `{item,version}` -> state; designated customer only, approval policy on; stores `confirmation:{by,name,at,version}`. Material/drawing changes invalidate confirmation and record that event.
POST /api/notifications/read `{id}` -> state. Notifications `{id,title,project,type,idRef,at,read}` link canonical detail and recheck access.
GET /api/export -> authenticated filtered JSON; owner-only backup/restore CLI captures full database + private files separately. No DB keys in frontend.
POST /api/password `{current,password}` -> session response and invalidates other sessions.

Frontend retains KO/EN and uploaded logo. Defaults use server-confirmed current role; PM may preview customer view of their own assigned projects, never field/customer privileges or exposed unpublished files. Field UI handles zero/one/multiple assignments and uses photos detail/forms on same route.

Release: implementation, local tests and browser verification complete. Hosted deployment remains pending credentials and environment verification; see README and VERIFICATION.md.

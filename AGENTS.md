# UI changes

Keep page IDs in `public/ui/page-registry.json` stable. Do not renumber or reuse retired page IDs. Run `node scripts/build-ui-identities.mjs` after public HTML changes and commit its generated registry and markup. Existing DOM `id` values are functional hooks and must not be replaced by UI IDs.

Use `data-ui-key="stable-descriptive-key"` on new or repeated controls when semantic identity must survive reordering. Repeated data records should expose a stable record key (`data-id` or `data-key`) on their container. Do not use visible copy, language, form values, secrets or timestamps as identity keys. Run duplicate/route/production-mode tests when changing the identity system.

For every future UI edit, record this scope in the work summary or change document:

- 대상 페이지:
- 대상 영역:
- 대상 요소:
- 변경 내용:
- 동작:
- 수정하지 않을 범위:

Production must expose data attributes but must never enable the debug overlay, even with query parameters or stored browser settings. Do not change navigation behavior merely to annotate destinations.

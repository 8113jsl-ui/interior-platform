# Public reference pages

The public Heron reference was captured on 2026-09-18. `reference-pages.json` records the exact page routes and asset provenance. The capture includes 26 pages: the home page, nine top-level pages, and sixteen resource articles across Insights, AI Practices and Design Workflows.

Page HTML is stored in `public/`; article pages use `public/insights/`, `public/ai-practices/`, and `public/design-workflows/`. Shared images, fonts, CSS and animation dependencies are local in `public/assets/`. The server serves extensionless routes and accepts resource category query parameters.

The shared original motion bundle initializes the loader, pointer effects, reveal animations, team detail panels, product sections, pricing controls, resources filters and FAQ interactions. Full document navigation initializes each destination once. The bundle is loaded only once per page. Analytics and development-server loaders are removed; CSP prevents external form submission and requests. Forms validate locally and explicitly report that nothing was sent.

No separate public login page or authenticated application entry was found in the inspected reference navigation. `/login` redirects to the existing interior app at `/app/`; this is not represented as a clone of an unseen Heron authentication screen. Authenticated, payment, calendar-booking and email-provider flows are not replicated by capturing these public pages.

Run `node scripts/sync-reference-pages.mjs` to refresh the explicitly listed public pages and discovered article links. Review source changes and the manifest before committing. Run `npm test` afterward. Local accounts, database, uploads and environment secrets remain excluded from Git.

This is a local visual reference implementation, not a claim of pixel-identical behavior in every browser or a production deployment of the reference company's services.

## Verification

- 58 automated tests passed, including requests to all 26 routes, local HTML asset references, single animation-bundle initialization, login redirect and anonymous API rejection.
- About rendered on desktop; scrolling and opening the first team detail panel worked.
- Resource category `?sc=ai-practices` selected the matching filter. Clicking its first article opened the correct local detail URL.
- At 390 × 844, About had no horizontal overflow (390px document width), no broken loaded images, and its mobile menu opened.
- No console errors were reported in the inspected About and article sessions. Every animation timing, pricing/FAQ state, embedded third-party service and browser combination has not been independently compared frame by frame.

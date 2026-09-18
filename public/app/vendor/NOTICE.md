# PDF.js browser assets

These files are copied from the installed `pdfjs-dist` package, version **6.3.289**. Main module and worker must be upgraded together; also refresh the accompanying resources from the same package version.

- `pdf.mjs`, `pdf.worker.mjs`: Mozilla PDF.js, Apache License 2.0; see `LICENSE-PDFJS` and the license headers.
- `cmaps/`: character maps including East Asian encodings; retained package license notices accompany the maps.
- `standard_fonts/`: standard PDF fonts, with `LICENSE_FOXIT` and `LICENSE_LIBERATION`.
- `wasm/`: PDF image/color decoders and package fallback resources, with their `LICENSE_*` notices.
- `iccs/`: color profile and its `LICENSE`.

The extraction feature loads these assets on demand from `/app/vendor/`, without a CDN. The server must serve `.mjs` as JavaScript and `.wasm` as `application/wasm`. The application CSP needs `worker-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, and font access to `self`, `data:` and `blob:` for PDF.js font rendering. JavaScript `unsafe-eval` is not required. The rendering integration does not execute PDF document actions or build interactive form/annotation layers.

Some malformed, encrypted, or unsupported PDFs cannot be extracted. The existing PNG/JPEG preview upload remains available. Rasterized snapshots are a comparison aid, not a replacement for the original drawing or a guarantee that every font/color reproduces exactly. Current supported browser APIs (including module workers and WebAssembly) are required.

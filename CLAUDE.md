# CLAUDE.md

Project context and guidance for AI coding assistants working on this codebase.

## Project overview

A browser-only PWA for UK sole traders and micro-businesses to scan receipts, extract
VAT data, and export to CSV. No backend, no accounts, no data leaves the device.
See README.md for the full rationale.

## Tech stack

- **Vite 8** + **TypeScript (strict)** — build tooling
- **Tesseract.js 6** — in-browser OCR, runs in a Web Worker
- **vite-plugin-pwa 1.x** — service worker and Web App Manifest generation
- **vite-plugin-mkcert 1.x** — local HTTPS (required for camera and PWA APIs)
- **Vitest 4** + **@vitest/ui** — unit tests

## Architecture

Data flow is linear, not reactive:

```text
image/PDF file → file-input.ts → pipeline.ts → ocr.ts → parser.ts → ui.ts (form)
                                      └→ pdf.ts (text extract, or raster → ocr.ts)
form → export-actions.ts → receipt-formatters.ts → clipboard / download
```

No state management layer. DOM is the state for the form fields; saved receipt
history is persisted in `localStorage`. `main.ts` wires event listeners;
everything else is pure functions or simple class-free modules.

## Key files

| File                        | Responsibility                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `src/types.ts`              | All shared interfaces and types                                                               |
| `src/parser.ts`             | Regex heuristics for UK receipts — most domain logic lives here                               |
| `src/ocr.ts`                | Tesseract.js wrapper; worker is created once and reused                                       |
| `src/pdf.ts`                | PDF handling — text extraction for machine-generated PDFs, raster conversion for scanned PDFs |
| `src/pipeline.ts`           | Async scan orchestration — file → OCR → parse → form                                          |
| `src/file-input.ts`         | File selection, drag-and-drop, and keyboard access handling                                   |
| `src/export-actions.ts`     | Save, copy, download wiring; receipt history with localStorage persistence                    |
| `src/receipt-formatters.ts` | CSV and plain-text formatting (RFC 4180 compliant)                                            |
| `src/vat-calculator.ts`     | Auto-recalculates VAT amount and subtotal when rate or total changes                          |
| `src/pwa-install.ts`        | Deferred PWA install prompt handling                                                          |
| `src/ui.ts`                 | DOM helpers: form population, toasts, status updates                                          |
| `src/main.ts`               | Entry point; event wiring only                                                                |
| `src/css/tokens.css`        | Design tokens — all colours, spacing, radius, typography                                      |
| `src/css/`                  | All styles in cascade layers with design tokens                                               |
| `tests/`                    | Vitest unit tests                                                                             |

## Conventions

- **TypeScript strict mode** — no `any`, no non-null assertions without comment
- **No classes** except where a clear lifecycle exists (none currently)
- **No framework** — vanilla TS + direct DOM. Keep it that way unless there is
  a compelling reason; complexity budget is intentionally minimal
- **CSS layers** — `reset → tokens → base → layout → components → utilities`
  Do not add styles outside a layer.
- **CSS nesting** — use native CSS nesting (`&`) not SCSS
- **Design tokens** — all colours, spacing, radius, and typography values
  must come from custom properties in the `tokens` layer
- **Accessibility** — semantic HTML, ARIA labels on interactive elements,
  `focus-visible` rings, `prefers-reduced-motion` respected in all animations

## Running locally

```bash
npm install
npm run dev        # starts https://localhost:5173 (mkcert cert auto-generated)
npm run test:ui    # opens Vitest UI at https://localhost:51204/__vitest__/
npm run build      # type-check + build to dist/
```

## Testing

Tests live in `tests/`. Run with:

```bash
npm test              # single run
npm run test:watch    # watch mode
npm run test:ui       # Vitest browser UI
npm run test:coverage # coverage report → coverage/index.html
```

`src/main.ts` is excluded from coverage — it is a DOM event-wiring file better
tested via integration/e2e if that becomes worthwhile.

## Before pushing

Always run both before committing or pushing — the CI runs both and will fail if either does:

```bash
npm test        # all 6 test suites must pass
npm run build   # tsc type-check + Vite build must succeed
```

After any functional change, consider whether unit tests need adding, updating,
or removing. Tests live in `tests/` and mirror source file names
(e.g. `src/export-actions.ts` → `tests/export-actions.test.ts`).

## Deployment

Push to `main` → GitHub Actions deploys to Pages automatically.
`base` in `vite.config.ts` is set to `'/receipt-scanner/'`.

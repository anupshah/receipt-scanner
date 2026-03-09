---
name: vitest-patterns
description: >
  Testing conventions for this Vitest project. Use when adding new
  test files or extending existing ones. Covers fixture patterns,
  what is and isn't tested (main.ts excluded), and how to structure
  tests for the parser and export modules.
compatibility: Vitest 4.x, jsdom environment
---

# Vitest Testing Patterns

## Running Tests

```bash
npm test              # single run
npm run test:watch    # watch mode
npm run test:ui       # Vitest browser UI at https://localhost:51204/__vitest__/
npm run test:coverage # coverage → coverage/index.html
```

## Configuration (in `vite.config.ts`)

```ts
test: {
  environment: 'jsdom',
  globals: true,
  include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov'],
    include: ['src/**/*.ts'],
    exclude: ['src/main.ts'],   // event-wiring only — tested via e2e if ever
  },
}
```

## Test Files

```text
tests/
  parser.test.ts              — parseReceipt(), parsePoundLoose(), all extraction functions
  receipt-formatters.test.ts  — buildCSV(), receiptToCSVRow(), receiptToText(), downloadCSV()
  ui.test.ts                  — showSection/hideSection, updateStatus, populateForm, readForm, showToast, showImagePreview
  vat-calculator.test.ts      — wireVatCalculations() via DOM events
  pipeline.test.ts            — setProcessing(), scanReceipt() with vi.mock
```

## The `receipt()` Helper (parser tests)

```ts
/** Build a minimal raw-text receipt string from parts */
function receipt(lines: string[]): string {
  return lines.join("\n");
}

// Usage
const { data } = parseReceipt(
  receipt(["Costa Coffee", "Date: 01/03/2024", "Total: £4.50"]),
);
```

Always use this helper rather than inline strings — it keeps tests readable and makes line-count reasoning easy.

## Parser Test Conventions

- **Always test the null case** explicitly — every extraction function can return `null`, and parsers silently swallow errors rather than throw.

```ts
it("returns null when no candidate lines exist", () => {
  const { data } = parseReceipt(receipt(["123", "456", "789"]));
  expect(data.vendor).toBeNull();
});
```

- **Test confidence levels** when they affect UX (badges shown to user): `'high'`, `'medium'`, `'low'`.
- **Test OCR noise patterns**: dropped decimal points (e.g. `7050` vs `70.50`), `€` instead of `@`, ALL CAPS vendor names.
- Group by extraction function: `describe('vendor extraction', ...)`, `describe('date extraction', ...)`, etc.

## Export Test Conventions

```ts
// Fixtures — full and sparse
const fullReceipt: ReceiptData = { vendor: 'Costa Coffee', date: '2024-03-15', ... }
const sparseReceipt: ReceiptData = { vendor: null, date: null, total: null, ... }
```

- **Always test comma and quote escaping** — CSV is RFC 4180 compliant; fields containing `,` or `"` must be double-quoted and internal `"` doubled.
- **Always test the sparse (all-null) case** — ensures no `undefined` leaks into CSV output.
- Test both `buildCSV()` (header + row) and `receiptToCSVRow()` (row only) separately.

## What Is NOT Tested (and why)

- `src/main.ts` — event-wiring only; excluded from coverage config; covered by e2e if that ever exists.
- `src/ocr.ts` — requires real browser + Tesseract WASM worker; not unit-testable.
- `src/pdf.ts` — requires PDF.js canvas rendering in a real browser context.
- `src/export-actions.ts` — pure DOM event wiring; better suited to e2e tests.
- `src/file-input.ts` — drag-and-drop and file input event wiring; better suited to e2e tests.
- `src/pwa-install.ts` — depends on `BeforeInstallPromptEvent`, a non-standard browser API unavailable in jsdom.

## Import Style

```ts
import { describe, it, expect } from "vitest"; // explicit, not globals
import { parseReceipt } from "../src/parser";
import type { ReceiptData } from "../src/types";
```

Even though `globals: true` is set in config, importing explicitly is preferred for clarity.

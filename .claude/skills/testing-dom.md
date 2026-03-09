---
name: testing-dom
description: >
  Patterns for DOM-based unit tests in this project using Vitest + jsdom.
  Use when writing tests for ui.ts, vat-calculator.ts, pipeline.ts, or any
  module that interacts with the DOM or imports modules that do. Covers DOM
  fixture setup, vi.mock for module dependencies, and browser API stubs.
compatibility: Vitest 4.x, jsdom 28.x
---

# DOM Testing Patterns

## Environment

jsdom is configured globally — no per-file setup needed:

```ts
// vite.config.ts
test: {
  environment: 'jsdom',
  globals: true,
}
```

## DOM Fixture Setup

Use `document.body.innerHTML` in `beforeEach` to give every test a clean slate.
Define only the elements the module under test actually queries.

```ts
beforeEach(() => {
  document.body.innerHTML = `
    <input id="field-total" />
    <select id="field-vat-rate"></select>
    <input id="field-vat-amount" />
    <input id="field-subtotal" />
  `;
});
```

Reset between tests — `beforeEach` rebuilds innerHTML, which also removes all
event listeners added in the previous test (the elements are replaced).

## Triggering DOM Events

```ts
const input = document.getElementById('field-total') as HTMLInputElement;
input.value = '120';
input.dispatchEvent(new Event('change'));
```

Use `new Event('change')` not `new InputEvent` — the modules listen for `'change'`.

## Mocking Module Imports (`vi.mock`)

Mock entire modules at the top level, before imports:

```ts
vi.mock('../src/ocr', () => ({ recogniseImage: vi.fn() }))
vi.mock('../src/pdf', () => ({ extractPdfText: vi.fn(), pdfToImageBlob: vi.fn() }))
vi.mock('../src/parser', () => ({ parseReceipt: vi.fn() }))
vi.mock('../src/ui', () => ({
  populateForm: vi.fn(),
  showImagePreview: vi.fn(),
  updateStatus: vi.fn(),
  showToast: vi.fn(),
  hideSection: vi.fn(),
}))
```

Then import and cast for type-safe mock methods:

```ts
import { recogniseImage } from '../src/ocr'
const mockRecognise = vi.mocked(recogniseImage)

beforeEach(() => {
  vi.clearAllMocks()
  mockRecognise.mockResolvedValue('raw text')
})
```

Always call `vi.clearAllMocks()` in `beforeEach` to reset call counts between tests.

## Stubbing Browser APIs not in jsdom

`URL.createObjectURL` and `URL.revokeObjectURL` are not implemented in jsdom:

```ts
beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn().mockReturnValue('blob:fake-url'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
```

Spy on `HTMLAnchorElement.prototype.click` to intercept download triggers:

```ts
const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
```

## Fake Timers (setTimeout / requestAnimationFrame)

For functions using `setTimeout` or `requestAnimationFrame` (e.g. `showToast`, `updateStatus` done phase):

```ts
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

it('hides after delay', () => {
  updateStatus({ phase: 'done' })
  expect(region.hasAttribute('hidden')).toBe(false) // not yet hidden
  vi.advanceTimersByTime(1500)
  expect(region.hasAttribute('hidden')).toBe(true)  // now hidden
})
```

## jsdom Quirks to Know

- **`<progress>.value` is clamped to `[0, max]`** where default `max = 1`. Set `bar.max = 100` before testing `bar.value = 100`.
- **`requestAnimationFrame`** is available in jsdom but runs synchronously under fake timers via `vi.advanceTimersByTime(0)`.
- **`URL.createObjectURL`** throws in jsdom — always stub it when testing code that previews images or triggers downloads.
- **`transitionend`** events do not fire automatically in jsdom — tests that depend on them need to dispatch the event manually or test state before the transition.

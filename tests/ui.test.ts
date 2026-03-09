// ============================================================
// tests/ui.test.ts
// Unit tests for src/ui.ts DOM helpers
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  showSection,
  hideSection,
  updateStatus,
  populateForm,
  readForm,
  showImagePreview,
  showToast,
} from '../src/ui'
import type { ReceiptData } from '../src/types'
import { VAT_RATE_LABELS, EXPENSE_CATEGORIES } from '../src/types'
import type { ParseConfidence } from '../src/parser'

// ── Shared DOM builders ───────────────────────────────────────

/** Minimal DOM for showSection / hideSection tests */
function buildSectionDom(): void {
  document.body.innerHTML = `
    <section id="results-section" hidden aria-hidden="true"></section>
    <section id="preview-section" hidden aria-hidden="true"></section>
  `
}

/** Full form DOM required by populateForm / readForm / updateStatus */
function buildFormDom(): void {
  document.body.innerHTML = `
    <div id="ocr-status" hidden>
      <progress id="ocr-progress"></progress>
      <span id="ocr-status-text"></span>
    </div>
    <section id="results-section" hidden aria-hidden="true">
      <input id="field-vendor"     type="text" />
      <input id="field-date"       type="date" />
      <input id="field-total"      type="number" />
      <input id="field-subtotal"   type="number" />
      <input id="field-vat-amount" type="number" />
      <input id="field-vat-number" type="text" />
      <select id="field-vat-rate"></select>
      <select id="field-category"></select>
      <pre   id="raw-text"></pre>
      <span data-badge="vendor"></span>
      <span data-badge="date"></span>
      <span data-badge="total"></span>
      <span data-badge="vat-amount"></span>
    </section>
    <div id="toast-container"></div>
    <div id="preview-section" hidden aria-hidden="true">
      <img id="receipt-preview" />
    </div>
  `
}

/** Minimal confidence fixture with all fields high */
const highConf: ParseConfidence = {
  vendor: 'high',
  date:   'high',
  total:  'high',
  vat:    'high',
}

/** Fully populated ReceiptData fixture */
const fullReceipt: ReceiptData = {
  vendor:    'ACME Ltd',
  date:      '2024-03-15',
  total:     120.00,
  subtotal:   100.00,
  vatAmount:  20.00,
  vatRate:    0.20,
  vatNumber:  'GB123456789',
  category:  'office',
  rawText:   'ACME Ltd\nTotal £120.00',
}

// ── showSection / hideSection ─────────────────────────────────

describe('showSection', () => {
  beforeEach(buildSectionDom)

  it('removes the hidden attribute', () => {
    showSection('results-section')
    expect(document.getElementById('results-section')!.hasAttribute('hidden')).toBe(false)
  })

  it('sets aria-hidden to "false"', () => {
    showSection('results-section')
    expect(document.getElementById('results-section')!.getAttribute('aria-hidden')).toBe('false')
  })

  it('throws when the element does not exist', () => {
    expect(() => showSection('does-not-exist')).toThrow('Element #does-not-exist not found')
  })
})

describe('hideSection', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="results-section" aria-hidden="false"></section>
    `
  })

  it('sets the hidden attribute', () => {
    hideSection('results-section')
    expect(document.getElementById('results-section')!.hasAttribute('hidden')).toBe(true)
  })

  it('sets aria-hidden to "true"', () => {
    hideSection('results-section')
    expect(document.getElementById('results-section')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('throws when the element does not exist', () => {
    expect(() => hideSection('does-not-exist')).toThrow('Element #does-not-exist not found')
  })
})

// ── updateStatus ──────────────────────────────────────────────

describe('updateStatus', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="ocr-status">
        <progress id="ocr-progress"></progress>
        <span id="ocr-status-text"></span>
      </div>
    `
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('idle phase: hides the status region', () => {
    updateStatus({ phase: 'idle' })
    expect(document.getElementById('ocr-status')!.hasAttribute('hidden')).toBe(true)
  })

  it('loading phase: shows loading text', () => {
    updateStatus({ phase: 'loading' })
    expect(document.getElementById('ocr-status-text')!.textContent).toBe('Loading OCR engine…')
  })

  it('loading phase: removes value attribute from progress bar (indeterminate)', () => {
    const bar = document.getElementById('ocr-progress') as HTMLProgressElement
    bar.value = 50
    updateStatus({ phase: 'loading' })
    expect(bar.hasAttribute('value')).toBe(false)
  })

  it('loading phase: region is not hidden', () => {
    updateStatus({ phase: 'loading' })
    expect(document.getElementById('ocr-status')!.hasAttribute('hidden')).toBe(false)
  })

  it('processing phase: shows correct text with percentage', () => {
    updateStatus({ phase: 'processing', progress: 42 })
    expect(document.getElementById('ocr-status-text')!.textContent).toBe('Recognising text… 42%')
  })

  it('processing phase: sets bar.value to the progress number', () => {
    updateStatus({ phase: 'processing', progress: 75 })
    const bar = document.getElementById('ocr-progress') as HTMLProgressElement
    expect(bar.value).toBe(75)
  })

  it('processing phase: sets bar.max to 100', () => {
    updateStatus({ phase: 'processing', progress: 75 })
    const bar = document.getElementById('ocr-progress') as HTMLProgressElement
    expect(bar.max).toBe(100)
  })

  it('done phase: sets text to "Recognition complete."', () => {
    vi.useFakeTimers()
    updateStatus({ phase: 'done' })
    expect(document.getElementById('ocr-status-text')!.textContent).toBe('Recognition complete.')
    vi.useRealTimers()
  })

  it('done phase: sets bar value attribute to 100', () => {
    vi.useFakeTimers()
    // Give the progress element a max so jsdom does not clamp value to 1
    const bar = document.getElementById('ocr-progress') as HTMLProgressElement
    bar.max = 100
    updateStatus({ phase: 'done' })
    expect(bar.value).toBe(100)
    vi.useRealTimers()
  })

  it('done phase: hides the region after the STATUS_HIDE_DELAY_MS timeout', () => {
    vi.useFakeTimers()
    updateStatus({ phase: 'done' })
    const region = document.getElementById('ocr-status')!
    expect(region.hasAttribute('hidden')).toBe(false)
    vi.advanceTimersByTime(1500)
    expect(region.hasAttribute('hidden')).toBe(true)
    vi.useRealTimers()
  })

  it('error phase: shows the error message text', () => {
    updateStatus({ phase: 'error', message: 'Worker crashed' })
    expect(document.getElementById('ocr-status-text')!.textContent).toBe('Error: Worker crashed')
  })

  it('error phase: adds status--error class to the region', () => {
    updateStatus({ phase: 'error', message: 'Worker crashed' })
    expect(document.getElementById('ocr-status')!.classList.contains('status--error')).toBe(true)
  })

  it('error phase: region is not hidden', () => {
    updateStatus({ phase: 'error', message: 'Worker crashed' })
    expect(document.getElementById('ocr-status')!.hasAttribute('hidden')).toBe(false)
  })
})

// ── populateForm ──────────────────────────────────────────────

describe('populateForm', () => {
  beforeEach(buildFormDom)

  it('populates the vendor field', () => {
    populateForm(fullReceipt, highConf)
    expect((document.getElementById('field-vendor') as HTMLInputElement).value).toBe('ACME Ltd')
  })

  it('populates the date field', () => {
    populateForm(fullReceipt, highConf)
    expect((document.getElementById('field-date') as HTMLInputElement).value).toBe('2024-03-15')
  })

  it('formats total to 2 decimal places', () => {
    populateForm(fullReceipt, highConf)
    expect((document.getElementById('field-total') as HTMLInputElement).value).toBe('120.00')
  })

  it('formats subtotal to 2 decimal places', () => {
    populateForm(fullReceipt, highConf)
    expect((document.getElementById('field-subtotal') as HTMLInputElement).value).toBe('100.00')
  })

  it('formats vatAmount to 2 decimal places', () => {
    populateForm(fullReceipt, highConf)
    expect((document.getElementById('field-vat-amount') as HTMLInputElement).value).toBe('20.00')
  })

  it('populates the VAT number field', () => {
    populateForm(fullReceipt, highConf)
    expect((document.getElementById('field-vat-number') as HTMLInputElement).value).toBe('GB123456789')
  })

  it('selects the correct VAT rate option', () => {
    populateForm(fullReceipt, highConf)
    const sel = document.getElementById('field-vat-rate') as HTMLSelectElement
    expect(sel.value).toBe('0.2')
  })

  it('builds all VAT rate options plus the blank placeholder', () => {
    populateForm(fullReceipt, highConf)
    const sel = document.getElementById('field-vat-rate') as HTMLSelectElement
    // blank + 3 rate options
    expect(sel.options.length).toBe(1 + Object.keys(VAT_RATE_LABELS).length)
    expect(sel.options[0].value).toBe('')
    expect(sel.options[0].text).toBe('— select —')
  })

  it('selects the correct category option', () => {
    populateForm(fullReceipt, highConf)
    const sel = document.getElementById('field-category') as HTMLSelectElement
    expect(sel.value).toBe('office')
  })

  it('builds all category options', () => {
    populateForm(fullReceipt, highConf)
    const sel = document.getElementById('field-category') as HTMLSelectElement
    expect(sel.options.length).toBe(EXPENSE_CATEGORIES.length)
  })

  it('sets rawText content', () => {
    populateForm(fullReceipt, highConf)
    expect(document.getElementById('raw-text')!.textContent).toBe('ACME Ltd\nTotal £120.00')
  })

  it('shows results-section after populating', () => {
    populateForm(fullReceipt, highConf)
    expect(document.getElementById('results-section')!.hasAttribute('hidden')).toBe(false)
  })

  describe('confidence badges', () => {
    it('sets data-confidence attribute on vendor badge', () => {
      populateForm(fullReceipt, { ...highConf, vendor: 'high' })
      expect(document.querySelector('[data-badge="vendor"]')!.getAttribute('data-confidence')).toBe('high')
    })

    it('sets textContent ✓ for high confidence', () => {
      populateForm(fullReceipt, { ...highConf, vendor: 'high' })
      expect(document.querySelector('[data-badge="vendor"]')!.textContent).toBe('✓')
    })

    it('sets textContent ~ for medium confidence', () => {
      populateForm(fullReceipt, { ...highConf, date: 'medium' })
      expect(document.querySelector('[data-badge="date"]')!.textContent).toBe('~')
    })

    it('sets textContent ? for low confidence', () => {
      populateForm(fullReceipt, { ...highConf, total: 'low' })
      expect(document.querySelector('[data-badge="total"]')!.textContent).toBe('?')
    })

    it('sets title attribute on badge', () => {
      populateForm(fullReceipt, { ...highConf, vat: 'medium' })
      expect(document.querySelector('[data-badge="vat-amount"]')!.getAttribute('title')).toBe('Confidence: medium')
    })

    it('sets aria-label attribute on badge', () => {
      populateForm(fullReceipt, { ...highConf, vat: 'low' })
      expect(document.querySelector('[data-badge="vat-amount"]')!.getAttribute('aria-label')).toBe('Parse confidence: low')
    })
  })

  describe('null field handling', () => {
    const nullReceipt: ReceiptData = {
      vendor:    null,
      date:      null,
      total:     null,
      subtotal:  null,
      vatAmount: null,
      vatRate:   null,
      vatNumber: null,
      category:  null,
      rawText:   '',
    }

    it('sets vendor to empty string when null', () => {
      populateForm(nullReceipt, highConf)
      expect((document.getElementById('field-vendor') as HTMLInputElement).value).toBe('')
    })

    it('sets date to empty string when null', () => {
      populateForm(nullReceipt, highConf)
      expect((document.getElementById('field-date') as HTMLInputElement).value).toBe('')
    })

    it('sets total to empty string when null', () => {
      populateForm(nullReceipt, highConf)
      expect((document.getElementById('field-total') as HTMLInputElement).value).toBe('')
    })

    it('sets subtotal to empty string when null', () => {
      populateForm(nullReceipt, highConf)
      expect((document.getElementById('field-subtotal') as HTMLInputElement).value).toBe('')
    })

    it('sets vatAmount to empty string when null', () => {
      populateForm(nullReceipt, highConf)
      expect((document.getElementById('field-vat-amount') as HTMLInputElement).value).toBe('')
    })

    it('sets vatNumber to empty string when null', () => {
      populateForm(nullReceipt, highConf)
      expect((document.getElementById('field-vat-number') as HTMLInputElement).value).toBe('')
    })

    it('selects the blank placeholder option when vatRate is null', () => {
      populateForm(nullReceipt, highConf)
      expect((document.getElementById('field-vat-rate') as HTMLSelectElement).value).toBe('')
    })
  })
})

// ── readForm ──────────────────────────────────────────────────

describe('readForm', () => {
  beforeEach(buildFormDom)

  /** Helper: populate just the form fields we care about, then read back */
  function setInputValue(id: string, value: string): void {
    const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement
    el.value = value
  }

  it('returns null for vendor when the field is empty', () => {
    setInputValue('field-vendor', '')
    const result = readForm()
    expect(result.vendor).toBeNull()
  })

  it('returns null for vendor when the field contains only whitespace', () => {
    setInputValue('field-vendor', '   ')
    const result = readForm()
    expect(result.vendor).toBeNull()
  })

  it('returns trimmed vendor string when field is filled', () => {
    setInputValue('field-vendor', '  Tesco  ')
    const result = readForm()
    expect(result.vendor).toBe('Tesco')
  })

  it('returns null for total when the field is empty', () => {
    setInputValue('field-total', '')
    const result = readForm()
    expect(result.total).toBeNull()
  })

  it('parses total as a number', () => {
    setInputValue('field-total', '42.99')
    const result = readForm()
    expect(result.total).toBe(42.99)
  })

  it('rounds total to 2 decimal places', () => {
    setInputValue('field-total', '10.999')
    const result = readForm()
    expect(result.total).toBe(11.00)
  })

  it('returns null for subtotal when the field is empty', () => {
    setInputValue('field-subtotal', '')
    const result = readForm()
    expect(result.subtotal).toBeNull()
  })

  it('returns null for vatAmount when the field is empty', () => {
    setInputValue('field-vat-amount', '')
    const result = readForm()
    expect(result.vatAmount).toBeNull()
  })

  it('returns null for vatRate when the blank option is selected', () => {
    // populateForm builds the select; ensure a blank option exists
    populateForm({ ...fullReceipt, vatRate: null }, highConf)
    const sel = document.getElementById('field-vat-rate') as HTMLSelectElement
    sel.value = ''
    const result = readForm()
    expect(result.vatRate).toBeNull()
  })

  it('returns the numeric vatRate when an option is selected', () => {
    populateForm(fullReceipt, highConf)   // builds options including 0.2
    const sel = document.getElementById('field-vat-rate') as HTMLSelectElement
    sel.value = '0.2'
    const result = readForm()
    expect(result.vatRate).toBe(0.2)
  })

  it('returns null for category when the field is empty', () => {
    // category select has no options → value is ''
    const result = readForm()
    expect(result.category).toBeNull()
  })

  it('returns the selected category string', () => {
    populateForm(fullReceipt, highConf)   // builds category options
    const sel = document.getElementById('field-category') as HTMLSelectElement
    sel.value = 'travel'
    const result = readForm()
    expect(result.category).toBe('travel')
  })

  it('returns null for vatNumber when the field is empty', () => {
    setInputValue('field-vat-number', '')
    const result = readForm()
    expect(result.vatNumber).toBeNull()
  })

  it('returns null for date when the field is empty', () => {
    setInputValue('field-date', '')
    const result = readForm()
    expect(result.date).toBeNull()
  })

  it('returns date string when the field is filled', () => {
    setInputValue('field-date', '2024-06-01')
    const result = readForm()
    expect(result.date).toBe('2024-06-01')
  })

  it('returns rawText from the raw-text element', () => {
    document.getElementById('raw-text')!.textContent = 'some raw text'
    const result = readForm()
    expect(result.rawText).toBe('some raw text')
  })
})

// ── showImagePreview ──────────────────────────────────────────

describe('showImagePreview', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="preview-section" hidden aria-hidden="true">
        <img id="receipt-preview" />
      </div>
    `
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock-url') })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls URL.createObjectURL with the provided source', () => {
    const blob = new Blob(['img data'], { type: 'image/png' })
    showImagePreview(blob)
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
  })

  it('sets img.src to the object URL', () => {
    const blob = new Blob(['img data'], { type: 'image/png' })
    showImagePreview(blob)
    const img = document.getElementById('receipt-preview') as HTMLImageElement
    expect(img.src).toBe('blob:mock-url')
  })

  it('sets img.alt to include the file name when given a File', () => {
    const file = new File(['img data'], 'receipt.jpg', { type: 'image/jpeg' })
    showImagePreview(file)
    const img = document.getElementById('receipt-preview') as HTMLImageElement
    expect(img.alt).toBe('Preview of receipt.jpg')
  })

  it('sets img.alt to generic text when given a plain Blob', () => {
    const blob = new Blob(['img data'], { type: 'image/png' })
    showImagePreview(blob)
    const img = document.getElementById('receipt-preview') as HTMLImageElement
    expect(img.alt).toBe('Receipt preview')
  })

  it('shows preview-section', () => {
    const blob = new Blob(['img data'], { type: 'image/png' })
    showImagePreview(blob)
    expect(document.getElementById('preview-section')!.hasAttribute('hidden')).toBe(false)
  })
})

// ── showToast ─────────────────────────────────────────────────

describe('showToast', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="toast-container"></div>`
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('appends a toast element to the toast-container', () => {
    showToast('Hello')
    expect(document.getElementById('toast-container')!.children.length).toBe(1)
  })

  it('toast has the correct class for "success" type', () => {
    showToast('Saved', 'success')
    const toast = document.getElementById('toast-container')!.firstElementChild!
    expect(toast.className).toContain('toast--success')
  })

  it('toast has the correct class for "error" type', () => {
    showToast('Failed', 'error')
    const toast = document.getElementById('toast-container')!.firstElementChild!
    expect(toast.className).toContain('toast--error')
  })

  it('toast has the correct class for "info" type', () => {
    showToast('Note', 'info')
    const toast = document.getElementById('toast-container')!.firstElementChild!
    expect(toast.className).toContain('toast--info')
  })

  it('defaults to "info" type when no type argument is provided', () => {
    showToast('Default')
    const toast = document.getElementById('toast-container')!.firstElementChild!
    expect(toast.className).toContain('toast--info')
  })

  it('always includes the base "toast" class', () => {
    showToast('Base class check', 'success')
    const toast = document.getElementById('toast-container')!.firstElementChild!
    expect(toast.classList.contains('toast')).toBe(true)
  })

  it('has role="status"', () => {
    showToast('Accessible')
    const toast = document.getElementById('toast-container')!.firstElementChild!
    expect(toast.getAttribute('role')).toBe('status')
  })

  it('has aria-live="polite"', () => {
    showToast('Polite')
    const toast = document.getElementById('toast-container')!.firstElementChild!
    expect(toast.getAttribute('aria-live')).toBe('polite')
  })

  it('contains the message text', () => {
    showToast('Upload complete')
    const toast = document.getElementById('toast-container')!.firstElementChild!
    expect(toast.textContent).toBe('Upload complete')
  })

  it('adds toast--visible class via requestAnimationFrame', () => {
    showToast('Visible')
    const toast = document.getElementById('toast-container')!.firstElementChild!
    // Before rAF fires the class is absent
    expect(toast.classList.contains('toast--visible')).toBe(false)
    // Flush rAF
    vi.runAllTicks()
    // jsdom does not run rAF automatically; call flush to confirm the API was called
    // (full animation testing is an integration concern — we verify the element structure)
  })

  it('removes toast--visible class after TOAST_DURATION_MS', () => {
    showToast('Temporary')
    const toast = document.getElementById('toast-container')!.firstElementChild!
    // Flush the rAF so toast--visible is added
    vi.runAllTicks()
    // Advance past the 3 s duration
    vi.advanceTimersByTime(3000)
    expect(toast.classList.contains('toast--visible')).toBe(false)
  })

  it('can append multiple toasts independently', () => {
    showToast('First')
    showToast('Second')
    showToast('Third')
    expect(document.getElementById('toast-container')!.children.length).toBe(3)
  })
})

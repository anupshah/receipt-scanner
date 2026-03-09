import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ReceiptData } from '../src/types'

// ── Mocks ──────────────────────────────────────────────────────
vi.mock('../src/receipt-formatters', () => ({
  buildCSV: vi.fn(() => 'csv-content'),
  receiptToText: vi.fn(() => 'text-content'),
  downloadCSV: vi.fn(),
}))

vi.mock('../src/ui', () => ({
  readForm: vi.fn((): ReceiptData => ({
    vendor: 'Test Shop',
    date: '2025-01-15',
    total: 24.00,
    subtotal: 20.00,
    vatAmount: 4.00,
    vatRate: 0.20,
    vatNumber: 'GB123456789',
    category: 'office',
    rawText: 'Test Shop\nTotal £24.00',
  })),
  showToast: vi.fn(),
}))

import { wireExportActions } from '../src/export-actions'
import { readForm, showToast } from '../src/ui'
import { downloadCSV } from '../src/receipt-formatters'

const mockReadForm = vi.mocked(readForm)
const mockShowToast = vi.mocked(showToast)
const mockDownloadCSV = vi.mocked(downloadCSV)

// ── DOM helpers ────────────────────────────────────────────────

function buildDom(): void {
  document.body.innerHTML = `
    <button id="history-count" aria-label="0 receipts saved">
      <span class="history-pill__count">0</span>
    </button>
    <div id="history-popover" popover="auto">
      <p id="history-popover-status">No receipts saved yet.</p>
      <p id="history-popover-hint"></p>
      <table id="history-popover-table" hidden>
        <thead><tr><th>Vendor</th><th>Total</th></tr></thead>
        <tbody id="history-popover-tbody"></tbody>
        <tfoot id="history-popover-tfoot">
          <tr><th>Total</th><td id="history-popover-total"></td></tr>
        </tfoot>
      </table>
      <menu id="history-popover-actions" hidden>
        <li><button id="popover-download-btn" type="button">Download CSV</button></li>
        <li><button id="popover-clear-btn" type="button">Clear all</button></li>
      </menu>
    </div>
    <button id="save-btn" type="button">Save Receipt</button>
    <button id="copy-csv-btn" type="button">Copy CSV</button>
    <button id="copy-text-btn" type="button">Copy Text</button>
    <button id="download-csv-btn" type="button">Download CSV</button>
    <button id="raw-toggle-btn" type="button" aria-expanded="false" aria-controls="raw-text-section">
      Show raw OCR text
    </button>
    <section id="raw-text-section" hidden aria-hidden="true">
      <pre id="raw-text"></pre>
    </section>
    <div id="toast-container"></div>
  `
  // jsdom doesn't implement hidePopover
  const popover = document.getElementById('history-popover') as HTMLElement
  popover.hidePopover = vi.fn()
}

function click(id: string): void {
  document.getElementById(id)!.dispatchEvent(new Event('click'))
}

function pillCount(): string {
  return document.querySelector('.history-pill__count')!.textContent!
}

function statusText(): string {
  return document.getElementById('history-popover-status')!.textContent!
}

function tableHidden(): boolean {
  return document.getElementById('history-popover-table')!.hasAttribute('hidden')
}

function actionsHidden(): boolean {
  return document.getElementById('history-popover-actions')!.hasAttribute('hidden')
}

function tbodyRows(): NodeListOf<HTMLTableRowElement> {
  return document.querySelectorAll('#history-popover-tbody tr')
}

function runningTotal(): string {
  return document.getElementById('history-popover-total')!.textContent!
}

// ── Tests ──────────────────────────────────────────────────────

describe('export-actions', () => {
  // Each test re-imports to reset module-level receiptHistory
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    buildDom()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
  })

  describe('wireExportActions', () => {
    it('wires without throwing', () => {
      expect(() => wireExportActions()).not.toThrow()
    })
  })

  describe('save button', () => {
    beforeEach(() => {
      wireExportActions()
      // Clear any state from prior tests by clicking clear
      click('popover-clear-btn')
      vi.clearAllMocks()
    })

    it('increments the pill count on save', () => {
      click('save-btn')
      expect(pillCount()).toBe('1')

      click('save-btn')
      expect(pillCount()).toBe('2')
    })

    it('shows success toast on save', () => {
      click('save-btn')
      expect(mockShowToast).toHaveBeenCalledWith(
        'Receipt saved (1 total)',
        'success',
      )
    })

    it('updates aria-label on the pill', () => {
      click('save-btn')
      const pill = document.getElementById('history-count')!
      expect(pill.getAttribute('aria-label')).toBe('1 receipt saved')

      click('save-btn')
      expect(pill.getAttribute('aria-label')).toBe('2 receipts saved')
    })
  })

  describe('popover summary table', () => {
    beforeEach(() => {
      wireExportActions()
      click('popover-clear-btn')
      vi.clearAllMocks()
    })

    it('table is hidden when no receipts saved', () => {
      expect(tableHidden()).toBe(true)
      expect(actionsHidden()).toBe(true)
      expect(statusText()).toBe('No receipts saved yet.')
    })

    it('table appears after saving a receipt', () => {
      click('save-btn')
      expect(tableHidden()).toBe(false)
      expect(actionsHidden()).toBe(false)
    })

    it('popover status updates with count', () => {
      click('save-btn')
      expect(statusText()).toBe('1 receipt queued for export.')

      click('save-btn')
      expect(statusText()).toBe('2 receipts queued for export.')
    })

    it('renders a row per saved receipt with vendor and total', () => {
      click('save-btn')
      const rows = tbodyRows()
      expect(rows).toHaveLength(1)

      const cells = rows[0].querySelectorAll('td')
      expect(cells[0].textContent).toBe('Test Shop')
      expect(cells[1].textContent).toBe('£24.00')
    })

    it('shows "Unknown" for null vendor', () => {
      mockReadForm.mockReturnValueOnce({
        vendor: null,
        date: null,
        total: 10.00,
        subtotal: null,
        vatAmount: null,
        vatRate: null,
        vatNumber: null,
        category: null,
        rawText: '',
      })
      click('save-btn')
      const cells = tbodyRows()[0].querySelectorAll('td')
      expect(cells[0].textContent).toBe('Unknown')
    })

    it('shows £0.00 for null total', () => {
      mockReadForm.mockReturnValueOnce({
        vendor: 'Shop',
        date: null,
        total: null,
        subtotal: null,
        vatAmount: null,
        vatRate: null,
        vatNumber: null,
        category: null,
        rawText: '',
      })
      click('save-btn')
      const cells = tbodyRows()[0].querySelectorAll('td')
      expect(cells[1].textContent).toBe('£0.00')
    })

    it('shows running total in tfoot', () => {
      click('save-btn') // £24.00

      mockReadForm.mockReturnValueOnce({
        vendor: 'Another Shop',
        date: null,
        total: 36.00,
        subtotal: 30.00,
        vatAmount: 6.00,
        vatRate: 0.20,
        vatNumber: null,
        category: null,
        rawText: '',
      })
      click('save-btn') // £36.00

      expect(runningTotal()).toBe('£60.00')
      expect(tbodyRows()).toHaveLength(2)
    })
  })

  describe('popover actions', () => {
    beforeEach(() => {
      wireExportActions()
      click('popover-clear-btn')
      vi.clearAllMocks()
    })

    it('download button calls downloadCSV with saved receipts', () => {
      click('save-btn')
      vi.clearAllMocks()

      click('popover-download-btn')
      expect(mockDownloadCSV).toHaveBeenCalledOnce()
      expect(mockShowToast).toHaveBeenCalledWith(
        'Downloaded CSV with 1 receipt(s)',
        'success',
      )
    })

    it('download button does nothing when no receipts saved', () => {
      click('popover-download-btn')
      expect(mockDownloadCSV).not.toHaveBeenCalled()
    })

    it('clear button resets everything', () => {
      click('save-btn')
      click('save-btn')
      vi.clearAllMocks()

      click('popover-clear-btn')
      expect(pillCount()).toBe('0')
      expect(tableHidden()).toBe(true)
      expect(actionsHidden()).toBe(true)
      expect(statusText()).toBe('No receipts saved yet.')
      expect(mockShowToast).toHaveBeenCalledWith(
        'Saved receipts cleared',
        'success',
      )
    })

    it('clear then save starts fresh at 1', () => {
      click('save-btn')
      click('save-btn')
      click('popover-clear-btn')
      vi.clearAllMocks()

      click('save-btn')
      expect(pillCount()).toBe('1')
      expect(tbodyRows()).toHaveLength(1)
    })
  })

  describe('download CSV button (main)', () => {
    beforeEach(() => {
      wireExportActions()
      click('popover-clear-btn')
      vi.clearAllMocks()
    })

    it('downloads current form when no receipts saved', () => {
      click('download-csv-btn')
      expect(mockDownloadCSV).toHaveBeenCalledOnce()
    })

    it('downloads all saved receipts when history exists', () => {
      click('save-btn')
      click('save-btn')
      vi.clearAllMocks()

      click('download-csv-btn')
      expect(mockDownloadCSV).toHaveBeenCalledOnce()
      expect(mockShowToast).toHaveBeenCalledWith(
        'Downloaded CSV with 2 receipt(s)',
        'success',
      )
    })
  })

  describe('localStorage persistence', () => {
    beforeEach(() => {
      wireExportActions()
      click('popover-clear-btn')
      vi.clearAllMocks()
    })

    it('persists receipts to localStorage on save', () => {
      click('save-btn')
      const stored = localStorage.getItem('receipt-scanner:history')
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].vendor).toBe('Test Shop')
    })

    it('clears localStorage on clear all', () => {
      click('save-btn')
      expect(localStorage.getItem('receipt-scanner:history')).not.toBeNull()

      click('popover-clear-btn')
      expect(localStorage.getItem('receipt-scanner:history')).toBeNull()
    })

    it('restores history from localStorage on wireExportActions', () => {
      // Seed localStorage with a receipt
      const receipt: ReceiptData = {
        vendor: 'Persisted Shop',
        date: '2025-06-01',
        total: 50.00,
        subtotal: 41.67,
        vatAmount: 8.33,
        vatRate: 0.20,
        vatNumber: null,
        category: 'office',
        rawText: '',
      }
      localStorage.setItem(
        'receipt-scanner:history',
        JSON.stringify([receipt]),
      )

      // Rebuild DOM and re-wire to simulate page reload
      buildDom()
      wireExportActions()

      expect(pillCount()).toBe('1')
      expect(statusText()).toBe('1 receipt queued for export.')
      expect(tableHidden()).toBe(false)
      const cells = tbodyRows()[0].querySelectorAll('td')
      expect(cells[0].textContent).toBe('Persisted Shop')
      expect(cells[1].textContent).toBe('£50.00')
    })

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem('receipt-scanner:history', 'not-json{{{')

      // Should not throw — falls back to empty array
      buildDom()
      expect(() => wireExportActions()).not.toThrow()
      expect(pillCount()).toBe('0')
    })

    it('handles non-array localStorage gracefully', () => {
      localStorage.setItem('receipt-scanner:history', '"a string"')

      buildDom()
      expect(() => wireExportActions()).not.toThrow()
      expect(pillCount()).toBe('0')
    })
  })

  describe('raw OCR text toggle', () => {
    beforeEach(() => {
      wireExportActions()
    })

    it('shows raw text section when toggled on', () => {
      click('raw-toggle-btn')
      const raw = document.getElementById('raw-text-section')!
      expect(raw.hasAttribute('hidden')).toBe(false)
      expect(raw.getAttribute('aria-hidden')).toBe('false')

      const btn = document.getElementById('raw-toggle-btn')!
      expect(btn.textContent).toBe('Hide raw text')
    })

    it('hides raw text section when toggled off', () => {
      click('raw-toggle-btn') // show
      click('raw-toggle-btn') // hide

      const raw = document.getElementById('raw-text-section')!
      expect(raw.hasAttribute('hidden')).toBe(true)
      expect(raw.getAttribute('aria-hidden')).toBe('true')

      const btn = document.getElementById('raw-toggle-btn')!
      expect(btn.textContent).toBe('Show raw OCR text')
    })
  })
})

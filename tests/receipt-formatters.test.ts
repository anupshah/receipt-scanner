// ============================================================
// tests/receipt-formatters.test.ts
// Unit tests for CSV generation and plain-text formatting
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildCSV, receiptToCSVRow, receiptToText, downloadCSV } from '../src/receipt-formatters'
import type { ReceiptData } from '../src/types'

// ── Fixtures ──────────────────────────────────────────────────

const fullReceipt: ReceiptData = {
  vendor: 'Costa Coffee',
  date: '2024-03-15',
  total: 4.80,
  subtotal: 4.00,
  vatAmount: 0.80,
  vatRate: 0.20,
  vatNumber: 'GB123456789',
  category: 'meals',
  rawText: 'Costa Coffee\nTotal £4.80\nVAT @ 20% £0.80',
}

const sparseReceipt: ReceiptData = {
  vendor: null,
  date: null,
  total: null,
  subtotal: null,
  vatAmount: null,
  vatRate: null,
  vatNumber: null,
  category: null,
  rawText: 'unclear text',
}

// ── receiptToCSVRow ───────────────────────────────────────────

describe('receiptToCSVRow', () => {
  it('outputs all fields in correct order', () => {
    const row = receiptToCSVRow(fullReceipt)
    const cells = row.split(',')
    expect(cells[0]).toBe('2024-03-15')         // Date
    expect(cells[1]).toBe('Costa Coffee')        // Vendor
    expect(cells[2]).toBe('meals')               // Category
    expect(cells[3]).toBe('4.80')                // Total
    expect(cells[4]).toBe('4.00')                // Subtotal
    expect(cells[5]).toBe('0.80')                // VAT Amount
    expect(cells[6]).toBe('20%')                 // VAT Rate
    expect(cells[7]).toBe('GB123456789')         // VAT Number
  })

  it('outputs empty strings for null fields', () => {
    const row = receiptToCSVRow(sparseReceipt)
    const cells = row.split(',')
    expect(cells[0]).toBe('')   // date
    expect(cells[1]).toBe('')   // vendor
    expect(cells[3]).toBe('')   // total
  })

  it('formats total to 2 decimal places', () => {
    const row = receiptToCSVRow({ ...fullReceipt, total: 10 })
    const cells = row.split(',')
    expect(cells[3]).toBe('10.00')
  })

  it('wraps vendor names containing commas in quotes', () => {
    const row = receiptToCSVRow({ ...fullReceipt, vendor: 'Smith, Jones & Co' })
    expect(row).toContain('"Smith, Jones & Co"')
  })

  it('escapes double quotes in vendor name', () => {
    const row = receiptToCSVRow({ ...fullReceipt, vendor: 'The "Best" Cafe' })
    expect(row).toContain('"The ""Best"" Cafe"')
  })

  it('formats 0% VAT rate correctly', () => {
    const row = receiptToCSVRow({ ...fullReceipt, vatRate: 0 })
    const cells = row.split(',')
    expect(cells[6]).toBe('0%')
  })

  it('formats 5% VAT rate correctly', () => {
    const row = receiptToCSVRow({ ...fullReceipt, vatRate: 0.05 })
    const cells = row.split(',')
    expect(cells[6]).toBe('5%')
  })

  it('outputs empty string for null VAT rate', () => {
    const row = receiptToCSVRow({ ...fullReceipt, vatRate: null })
    const cells = row.split(',')
    expect(cells[6]).toBe('')
  })
})

// ── buildCSV ──────────────────────────────────────────────────

describe('buildCSV', () => {
  it('includes header row as first line', () => {
    const csv = buildCSV([fullReceipt])
    const firstLine = csv.split('\n')[0]
    expect(firstLine).toContain('Date')
    expect(firstLine).toContain('Vendor')
    expect(firstLine).toContain('VAT Amount')
    expect(firstLine).toContain('VAT Rate')
  })

  it('includes one data row for one receipt', () => {
    const csv = buildCSV([fullReceipt])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2) // header + 1 row
  })

  it('includes multiple data rows for multiple receipts', () => {
    const csv = buildCSV([fullReceipt, sparseReceipt])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3) // header + 2 rows
  })

  it('produces empty CSV (header only) for empty array', () => {
    const csv = buildCSV([])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('Date')
  })

  it('is valid parseable CSV (no unmatched quotes)', () => {
    // Vendor with commas and quotes — a stress test
    const tricky: ReceiptData = {
      ...fullReceipt,
      vendor: 'Smith, "Jones" & Co',
    }
    const csv = buildCSV([tricky])
    // If this throws, CSV is malformed
    expect(() => csv.split('\n')).not.toThrow()
    expect(csv).toContain('"Smith, ""Jones"" & Co"')
  })
})

// ── receiptToText ─────────────────────────────────────────────

describe('receiptToText', () => {
  it('includes vendor', () => {
    expect(receiptToText(fullReceipt)).toContain('Costa Coffee')
  })

  it('includes date', () => {
    expect(receiptToText(fullReceipt)).toContain('2024-03-15')
  })

  it('includes formatted total with £', () => {
    expect(receiptToText(fullReceipt)).toContain('£4.80')
  })

  it('includes VAT amount and rate', () => {
    const text = receiptToText(fullReceipt)
    expect(text).toContain('£0.80')
    expect(text).toContain('20%')
  })

  it('includes VAT number when present', () => {
    expect(receiptToText(fullReceipt)).toContain('GB123456789')
  })

  it('omits VAT number line when absent', () => {
    const text = receiptToText({ ...fullReceipt, vatNumber: null })
    expect(text).not.toContain('VAT No')
  })

  it('shows dashes for null fields', () => {
    const text = receiptToText(sparseReceipt)
    expect(text).toContain('—')
  })
})

// ── downloadCSV ───────────────────────────────────────────────

describe('downloadCSV', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    })
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('triggers a click to initiate the download', () => {
    downloadCSV([fullReceipt])
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('uses receipts.csv as the default filename', () => {
    downloadCSV([fullReceipt])
    expect(clickSpy).toHaveBeenCalledOnce()
    const anchorEl = (clickSpy.mock.instances[0] as HTMLAnchorElement)
    expect(anchorEl.download).toBe('receipts.csv')
  })

  it('passes a custom filename through to the anchor element', () => {
    downloadCSV([fullReceipt], 'my-export.csv')
    const anchorEl = (clickSpy.mock.instances[0] as HTMLAnchorElement)
    expect(anchorEl.download).toBe('my-export.csv')
  })

  it('calls URL.revokeObjectURL to prevent memory leaks', () => {
    downloadCSV([fullReceipt])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})

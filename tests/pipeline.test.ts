// ============================================================
// tests/pipeline.test.ts
// Unit tests for src/pipeline.ts
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setProcessing, scanReceipt } from '../src/pipeline'
import type { ParseResult } from '../src/parser'

// ── Module mocks ──────────────────────────────────────────────

vi.mock('../src/ocr', () => ({
  recogniseImage: vi.fn(),
}))
vi.mock('../src/pdf', () => ({
  extractPdfText: vi.fn(),
  pdfToImageBlob: vi.fn(),
}))
vi.mock('../src/parser', () => ({
  parseReceipt: vi.fn(),
}))
vi.mock('../src/ui', () => ({
  populateForm: vi.fn(),
  showImagePreview: vi.fn(),
  updateStatus: vi.fn(),
  showToast: vi.fn(),
  hideSection: vi.fn(),
}))

// ── Typed mock references ─────────────────────────────────────

import { recogniseImage } from '../src/ocr'
import { extractPdfText, pdfToImageBlob } from '../src/pdf'
import { parseReceipt } from '../src/parser'
import { populateForm, showImagePreview, updateStatus, showToast, hideSection } from '../src/ui'

const mockRecogniseImage = vi.mocked(recogniseImage)
const mockExtractPdfText = vi.mocked(extractPdfText)
const mockPdfToImageBlob = vi.mocked(pdfToImageBlob)
const mockParseReceipt = vi.mocked(parseReceipt)
const mockPopulateForm = vi.mocked(populateForm)
const mockShowImagePreview = vi.mocked(showImagePreview)
const mockUpdateStatus = vi.mocked(updateStatus)
const mockShowToast = vi.mocked(showToast)
const mockHideSection = vi.mocked(hideSection)

// ── Fixtures ──────────────────────────────────────────────────

const parseResult: ParseResult = {
  data: {
    vendor: 'Test Shop',
    date: '2024-03-01',
    total: 12.00,
    subtotal: 10.00,
    vatAmount: 2.00,
    vatRate: 0.20,
    vatNumber: 'GB123456789',
    category: null,
    rawText: 'raw text',
  },
  confidence: {
    vendor: 'high' as const,
    date: 'high' as const,
    total: 'high' as const,
    vat: 'high' as const,
  },
}

// ── DOM setup ─────────────────────────────────────────────────

function setupDOM(): void {
  document.body.innerHTML = `
    <button id="scan-btn"></button>
    <div id="dropzone"></div>
    <div id="results-section"></div>
    <div id="preview-section"></div>
    <details id="examples-details"></details>
  `
}

function btn(): HTMLButtonElement {
  return document.getElementById('scan-btn') as HTMLButtonElement
}

function dropzone(): HTMLElement {
  return document.getElementById('dropzone') as HTMLElement
}

// ── Helpers ───────────────────────────────────────────────────

function makeFile(type: string): File {
  return new File(['content'], 'receipt.file', { type })
}

// ── setProcessing ─────────────────────────────────────────────

describe('setProcessing', () => {
  beforeEach(() => {
    setupDOM()
    vi.clearAllMocks()
  })

  describe('setProcessing(true)', () => {
    it('disables the scan button', () => {
      setProcessing(true)
      expect(btn().disabled).toBe(true)
    })

    it('sets aria-busy="true" on the button', () => {
      setProcessing(true)
      expect(btn().getAttribute('aria-busy')).toBe('true')
    })

    it('sets aria-disabled="true" on the dropzone', () => {
      setProcessing(true)
      expect(dropzone().getAttribute('aria-disabled')).toBe('true')
    })
  })

  describe('setProcessing(false)', () => {
    it('enables the scan button', () => {
      setProcessing(true)
      setProcessing(false)
      expect(btn().disabled).toBe(false)
    })

    it('sets aria-busy="false" on the button', () => {
      setProcessing(true)
      setProcessing(false)
      expect(btn().getAttribute('aria-busy')).toBe('false')
    })

    it('sets aria-disabled="false" on the dropzone', () => {
      setProcessing(true)
      setProcessing(false)
      expect(dropzone().getAttribute('aria-disabled')).toBe('false')
    })
  })
})

// ── scanReceipt ───────────────────────────────────────────────

describe('scanReceipt', () => {
  beforeEach(() => {
    setupDOM()
    vi.clearAllMocks()

    // Default happy-path return values
    mockRecogniseImage.mockResolvedValue('raw text')
    mockExtractPdfText.mockResolvedValue(null)
    mockPdfToImageBlob.mockResolvedValue(new Blob(['img'], { type: 'image/png' }))
    mockParseReceipt.mockReturnValue(parseResult)
  })

  // ── image file (non-PDF) ────────────────────────────────────

  describe('image file (non-PDF)', () => {
    it('sets aria-busy to true at start and false at end', async () => {
      let busyDuringRun = false
      mockRecogniseImage.mockImplementation(async () => {
        busyDuringRun = btn().getAttribute('aria-busy') === 'true'
        return 'raw text'
      })

      await scanReceipt(makeFile('image/jpeg'))

      expect(busyDuringRun).toBe(true)
      expect(btn().getAttribute('aria-busy')).toBe('false')
    })

    it('calls hideSection for results-section and preview-section', async () => {
      await scanReceipt(makeFile('image/jpeg'))
      expect(mockHideSection).toHaveBeenCalledWith('results-section')
      expect(mockHideSection).toHaveBeenCalledWith('preview-section')
    })

    it('calls showImagePreview with the file', async () => {
      const file = makeFile('image/jpeg')
      await scanReceipt(file)
      expect(mockShowImagePreview).toHaveBeenCalledWith(file)
    })

    it('calls recogniseImage with the file', async () => {
      const file = makeFile('image/jpeg')
      await scanReceipt(file)
      expect(mockRecogniseImage).toHaveBeenCalledWith(file, expect.any(Function))
    })

    it('calls parseReceipt with the OCR result', async () => {
      mockRecogniseImage.mockResolvedValue('ocr output')
      await scanReceipt(makeFile('image/jpeg'))
      expect(mockParseReceipt).toHaveBeenCalledWith('ocr output')
    })

    it('calls populateForm with the parse result', async () => {
      await scanReceipt(makeFile('image/jpeg'))
      expect(mockPopulateForm).toHaveBeenCalledWith(parseResult.data, parseResult.confidence)
    })

    it('calls setProcessing(false) in the finally block on success', async () => {
      await scanReceipt(makeFile('image/jpeg'))
      expect(btn().disabled).toBe(false)
    })
  })

  // ── PDF with extractable text ───────────────────────────────

  describe('PDF with extractable text', () => {
    it('calls extractPdfText and pdfToImageBlob in parallel', async () => {
      mockExtractPdfText.mockResolvedValue('extracted text')
      await scanReceipt(makeFile('application/pdf'))
      expect(mockExtractPdfText).toHaveBeenCalledTimes(1)
      expect(mockPdfToImageBlob).toHaveBeenCalledTimes(1)
    })

    it('does not call recogniseImage when extracted text is available', async () => {
      mockExtractPdfText.mockResolvedValue('extracted text')
      await scanReceipt(makeFile('application/pdf'))
      expect(mockRecogniseImage).not.toHaveBeenCalled()
    })

    it('calls updateStatus({ phase: "done" }) after text extraction', async () => {
      mockExtractPdfText.mockResolvedValue('extracted text')
      await scanReceipt(makeFile('application/pdf'))
      expect(mockUpdateStatus).toHaveBeenCalledWith({ phase: 'done' })
    })

    it('calls showImagePreview with the raster blob', async () => {
      const rasterBlob = new Blob(['img'], { type: 'image/png' })
      mockExtractPdfText.mockResolvedValue('extracted text')
      mockPdfToImageBlob.mockResolvedValue(rasterBlob)
      await scanReceipt(makeFile('application/pdf'))
      expect(mockShowImagePreview).toHaveBeenCalledWith(rasterBlob)
    })

    it('calls parseReceipt with the extracted text', async () => {
      mockExtractPdfText.mockResolvedValue('extracted text')
      await scanReceipt(makeFile('application/pdf'))
      expect(mockParseReceipt).toHaveBeenCalledWith('extracted text')
    })
  })

  // ── PDF with no extractable text (scanned PDF) ──────────────

  describe('PDF with no extractable text (scanned PDF)', () => {
    it('calls recogniseImage with the raster blob when extractPdfText returns null', async () => {
      const rasterBlob = new Blob(['img'], { type: 'image/png' })
      mockExtractPdfText.mockResolvedValue(null)
      mockPdfToImageBlob.mockResolvedValue(rasterBlob)
      await scanReceipt(makeFile('application/pdf'))
      expect(mockRecogniseImage).toHaveBeenCalledWith(rasterBlob, expect.any(Function))
    })
  })

  // ── error handling ───────────────────────────────────────────

  describe('error handling', () => {
    it('calls updateStatus with phase "error" and message when recogniseImage throws an Error', async () => {
      mockRecogniseImage.mockRejectedValue(new Error('OCR failed'))
      await scanReceipt(makeFile('image/jpeg'))
      expect(mockUpdateStatus).toHaveBeenCalledWith({ phase: 'error', message: 'OCR failed' })
    })

    it('calls showToast with "Scan failed: ..." and "error" when recogniseImage throws', async () => {
      mockRecogniseImage.mockRejectedValue(new Error('OCR failed'))
      await scanReceipt(makeFile('image/jpeg'))
      expect(mockShowToast).toHaveBeenCalledWith('Scan failed: OCR failed', 'error')
    })

    it('uses "Unknown error" as message for non-Error thrown values', async () => {
      mockRecogniseImage.mockRejectedValue('a plain string rejection')
      await scanReceipt(makeFile('image/jpeg'))
      expect(mockUpdateStatus).toHaveBeenCalledWith({ phase: 'error', message: 'Unknown error' })
      expect(mockShowToast).toHaveBeenCalledWith('Scan failed: Unknown error', 'error')
    })

    it('calls setProcessing(false) in the finally block after an error', async () => {
      mockRecogniseImage.mockRejectedValue(new Error('OCR failed'))
      await scanReceipt(makeFile('image/jpeg'))
      expect(btn().disabled).toBe(false)
      expect(btn().getAttribute('aria-busy')).toBe('false')
    })
  })
})

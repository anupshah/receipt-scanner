// ============================================================
// tests/parser.test.ts
// Unit tests for the receipt parser
// ============================================================

import { describe, it, expect } from 'vitest'
import { parseReceipt, parsePoundLoose } from '../src/parser'

// ── Helpers ───────────────────────────────────────────────────

/** Build a minimal raw-text receipt string from parts */
function receipt(lines: string[]): string {
  return lines.join('\n')
}

// ── parsePoundLoose unit tests ────────────────────────────────

describe('parsePoundLoose', () => {
  it('parses a normal decimal amount', () => {
    expect(parsePoundLoose('422.98')).toBe(422.98)
  })

  it('recovers decimal from space-as-decimal: "422 98" → 422.98', () => {
    expect(parsePoundLoose('422 98')).toBe(422.98)
  })

  it('recovers decimal from dropped point: "42298" → 422.98', () => {
    expect(parsePoundLoose('42298')).toBe(422.98)
  })

  it('treats 1–3 digit strings as whole pounds', () => {
    expect(parsePoundLoose('100')).toBe(100)
    expect(parsePoundLoose('42')).toBe(42)
  })

  it('strips £ and GBP prefix before parsing', () => {
    expect(parsePoundLoose('£422.98')).toBe(422.98)
    expect(parsePoundLoose('GBP422.98')).toBe(422.98)
  })

  it('returns null for empty input', () => {
    expect(parsePoundLoose('')).toBeNull()
  })
})

// ── Vendor extraction ─────────────────────────────────────────

describe('vendor extraction', () => {
  it('picks up a title-case business name from the first line', () => {
    const { data } = parseReceipt(receipt([
      'Costa Coffee',
      '123 High Street',
      'Date: 01/03/2024',
      'Total: £4.50',
    ]))
    expect(data.vendor).toBe('Costa Coffee')
  })

  it('picks up an ALL CAPS business name', () => {
    const { data } = parseReceipt(receipt([
      'TESCO STORES',
      'VAT No: GB123456789',
      'Total £22.50',
    ]))
    expect(data.vendor).toBe('TESCO STORES')
  })

  it('skips lines starting with a digit', () => {
    const { data } = parseReceipt(receipt([
      '123 High Street',
      'Pret A Manger',
      'Total: £8.00',
    ]))
    expect(data.vendor).toBe('Pret A Manger')
  })

  it('skips lines starting with "VAT"', () => {
    const { data } = parseReceipt(receipt([
      'VAT Number: GB123456789',
      'Waterstones Ltd',
      'Total: £12.99',
    ]))
    expect(data.vendor).toBe('Waterstones Ltd')
  })

  it('returns null when no candidate lines exist', () => {
    const { data } = parseReceipt(receipt(['123', '456', '789']))
    expect(data.vendor).toBeNull()
  })
})

// ── Date extraction ───────────────────────────────────────────

describe('date extraction', () => {
  it('parses DD/MM/YYYY', () => {
    const { data } = parseReceipt(receipt(['Date: 15/06/2023']))
    expect(data.date).toBe('2023-06-15')
  })

  it('parses DD-MM-YYYY', () => {
    const { data } = parseReceipt(receipt(['Date: 01-01-2024']))
    expect(data.date).toBe('2024-01-01')
  })

  it('parses DD/MM/YY', () => {
    const { data } = parseReceipt(receipt(['Date: 05/11/23']))
    expect(data.date).toBe('2023-11-05')
  })

  it('parses "DD Mon YYYY" format', () => {
    const { data } = parseReceipt(receipt(['12 March 2024']))
    expect(data.date).toBe('2024-03-12')
  })

  it('parses abbreviated month "Jan"', () => {
    const { data } = parseReceipt(receipt(['3 Jan 2024']))
    expect(data.date).toBe('2024-01-03')
  })

  it('parses ISO YYYY-MM-DD', () => {
    const { data } = parseReceipt(receipt(['2024-07-04']))
    expect(data.date).toBe('2024-07-04')
  })

  it('returns null when no date found', () => {
    const { data } = parseReceipt(receipt(['No dates here at all']))
    expect(data.date).toBeNull()
  })
})

// ── Total extraction ──────────────────────────────────────────

describe('total extraction', () => {
  it('extracts "Total: £X.XX"', () => {
    const { data } = parseReceipt(receipt(['Total: £42.50']))
    expect(data.total).toBe(42.50)
  })

  it('extracts "TOTAL DUE £X.XX"', () => {
    const { data } = parseReceipt(receipt(['TOTAL DUE £99.00']))
    expect(data.total).toBe(99.00)
  })

  it('extracts "Amount Paid £X.XX"', () => {
    const { data } = parseReceipt(receipt(['Amount Paid £18.75']))
    expect(data.total).toBe(18.75)
  })

  it('extracts "Grand Total £X.XX"', () => {
    const { data } = parseReceipt(receipt(['Grand Total £250.00']))
    expect(data.total).toBe(250.00)
  })

  it('extracts total including VAT label', () => {
    const { data } = parseReceipt(receipt(['Total inc. VAT £36.00']))
    expect(data.total).toBe(36.00)
  })

  it('handles comma-formatted amounts like £1,250.00', () => {
    const { data } = parseReceipt(receipt(['Total: £1,250.00']))
    expect(data.total).toBe(1250.00)
  })

  it('rounds to 2 decimal places', () => {
    const { data } = parseReceipt(receipt(['Total: £10.999']))
    // parsePound rounds: 10.999 → 11.00
    expect(data.total).toBe(11.00)
  })

  it('returns null when no total found', () => {
    const { data } = parseReceipt(receipt(['Nothing useful here']))
    expect(data.total).toBeNull()
  })

  it('recovers £422.98 when OCR emits a space instead of a decimal point', () => {
    // OCR artefact: "422.98" read as "422 98" (space-as-decimal)
    const { data } = parseReceipt(receipt(['TOTAL (inc. VAT) 422 98']))
    expect(data.total).toBe(422.98)
  })
})

// ── VAT extraction ────────────────────────────────────────────

describe('VAT extraction', () => {
  it('extracts explicit VAT @ 20%', () => {
    const { data } = parseReceipt(receipt([
      'Subtotal £30.00',
      'VAT @ 20% £6.00',
      'Total £36.00',
    ]))
    expect(data.vatAmount).toBe(6.00)
    expect(data.vatRate).toBe(0.20)
  })

  it('extracts explicit VAT @ 5%', () => {
    const { data } = parseReceipt(receipt([
      'VAT @ 5% £2.50',
      'Total £52.50',
    ]))
    expect(data.vatAmount).toBe(2.50)
    expect(data.vatRate).toBe(0.05)
  })

  it('extracts generic "VAT £X.XX" line', () => {
    const { data } = parseReceipt(receipt([
      'Total £120.00',
      'VAT £20.00',
    ]))
    expect(data.vatAmount).toBe(20.00)
  })

  it('infers 20% rate from amounts when not explicit', () => {
    // total=120, vatAmount=20 → implied rate = 20/100 = 0.20
    const { data } = parseReceipt(receipt([
      'Total £120.00',
      'VAT £20.00',
    ]))
    expect(data.vatRate).toBe(0.20)
  })

  it('derives subtotal from total minus VAT', () => {
    const { data } = parseReceipt(receipt([
      'Total £120.00',
      'VAT @ 20% £20.00',
    ]))
    expect(data.subtotal).toBe(100.00)
  })

  it('sets vatRate to 0 when VAT number present but no VAT amount', () => {
    const { data } = parseReceipt(receipt([
      'VAT No: GB123456789',
      'Total £50.00',
    ]))
    expect(data.vatRate).toBe(0)
    expect(data.vatAmount).toBeNull()
  })

  it('extracts VAT from Amazon-style tabular VAT summary (20% rate)', () => {
    // Amazon invoices present a VAT summary table where each rate row has:
    // "<rate>%  <subtotal excl. VAT>  <VAT amount>"
    const { data } = parseReceipt(receipt([
      'VAT rate Item subtotal (excl. VAT) VAT subtotal',
      '20% 12.04 2.40',
      'Total payable 14.44',
    ]))
    expect(data.vatAmount).toBe(2.40)
    expect(data.vatRate).toBe(0.20)
    expect(data.total).toBe(14.44)
  })

  it('recovers VAT amount when OCR emits space instead of decimal point', () => {
    // AMT pattern handles space-as-decimal for VAT lines too, not just totals
    const { data } = parseReceipt(receipt([
      'Subtotal £352.48',
      'VAT @ 20% 70 50',
      'Total £422.98',
    ]))
    expect(data.vatAmount).toBe(70.50)
    expect(data.vatRate).toBe(0.20)
  })

  it('does not zero-rate when a VAT number is present but a VAT amount is also found', () => {
    // Zero-rated fallback (vatRate = 0) must only fire when vatAmount is null.
    // If vatAmount is successfully extracted, the rate should reflect the real rate.
    const { data } = parseReceipt(receipt([
      'ACME SUPPLIES LTD',
      'VAT No: GB987654321',
      'Subtotal £100.00',
      'VAT @ 20% £20.00',
      'Total £120.00',
    ]))
    expect(data.vatAmount).toBe(20.00)
    expect(data.vatRate).not.toBe(0)
    expect(data.vatRate).toBe(0.20)
  })
})

// ── VAT number extraction ─────────────────────────────────────

describe('VAT number extraction', () => {
  it('extracts GB-prefixed VAT number', () => {
    const { data } = parseReceipt(receipt(['VAT No: GB123456789']))
    expect(data.vatNumber).toBe('GB123456789')
  })

  it('extracts numeric-only VAT number', () => {
    const { data } = parseReceipt(receipt(['VAT Reg: 123456789']))
    expect(data.vatNumber).toBe('123456789')
  })

  it('extracts VAT Registration Number variant', () => {
    const { data } = parseReceipt(receipt(['VAT Registration Number: GB987654321']))
    expect(data.vatNumber).toBe('GB987654321')
  })

  it('returns null when no VAT number present', () => {
    const { data } = parseReceipt(receipt(['Total: £10.00']))
    expect(data.vatNumber).toBeNull()
  })
})

// ── Category inference ────────────────────────────────────────

describe('category inference', () => {
  const cases: Array<[string, string]> = [
    ['Costa Coffee\nTotal £3.50', 'meals'],
    ['National Rail\nTotal £42.00', 'travel'],
    ['Premier Inn\nTotal £89.00', 'accommodation'],
    ['Staples Ltd\nTotal £15.00', 'office'],
    ['Apple Store\nlaptop stand\nTotal £49.00', 'equipment'],
    ['Adobe Inc\nsubscription\nTotal £54.99', 'software'],
    ['Unknown Vendor\nTotal £10.00', 'other'],
  ]

  it.each(cases)('infers category from "%s"', (text, expected) => {
    const { data } = parseReceipt(text)
    expect(data.category).toBe(expected)
  })
})

// ── Confidence ratings ────────────────────────────────────────

describe('confidence ratings', () => {
  it('returns high confidence for well-structured receipt', () => {
    const { confidence } = parseReceipt(receipt([
      'Costa Coffee',
      'Date: 15/03/2024',
      'Total £4.80',
      'VAT @ 20% £0.80',
    ]))
    expect(confidence.vendor).toBe('high')
    expect(confidence.date).toBe('high')
    expect(confidence.total).toBe('high')
    expect(confidence.vat).toBe('high')
  })

  it('returns low confidence for sparse text', () => {
    const { confidence } = parseReceipt('gibberish text no structure')
    expect(confidence.total).toBe('low')
    expect(confidence.date).toBe('low')
  })
})

// ── Realistic full receipt ────────────────────────────────────

describe('realistic full receipt', () => {
  const rawText = `
    PRET A MANGER
    15 Cheapside, London EC2V 6DX
    VAT Reg No: GB 754 2935 40

    Date: 22/02/2024
    Time: 12:34

    Almond Croissant        £2.95
    Flat White              £3.25
    Classic Cheddar Baguette £5.50

    Subtotal               £11.70
    VAT @ 20%               £1.95
    Total                  £13.65
  `.trim()

  it('extracts vendor correctly', () => {
    const { data } = parseReceipt(rawText)
    expect(data.vendor).toBe('PRET A MANGER')
  })

  it('extracts date correctly', () => {
    const { data } = parseReceipt(rawText)
    expect(data.date).toBe('2024-02-22')
  })

  it('extracts total correctly', () => {
    const { data } = parseReceipt(rawText)
    expect(data.total).toBe(13.65)
  })

  it('extracts VAT amount correctly', () => {
    const { data } = parseReceipt(rawText)
    expect(data.vatAmount).toBe(1.95)
    expect(data.vatRate).toBe(0.20)
  })

  it('infers meals category', () => {
    const { data } = parseReceipt(rawText)
    expect(data.category).toBe('meals')
  })

  it('preserves raw text', () => {
    const { data } = parseReceipt(rawText)
    expect(data.rawText).toBe(rawText)
  })
})

// ── Multi-line PDF-extracted text ─────────────────────────────

describe('multi-line PDF-style extracted text', () => {
  // Clean text as extracted from a machine-generated PDF — no OCR noise,
  // each field on its own line, no stray characters.
  const pdfText = receipt([
    'TECHDESK SOLUTIONS LTD',
    'Unit 4, Innovation Park, Bristol, BS1 5TH',
    'Invoice No: INV-2024-0142',
    'Date: 14 January 2024',
    'VAT Registration Number: GB987654321',
    'Subtotal (ex. VAT): £352.48',
    'VAT @ 20%: £70.50',
    'TOTAL: £422.98',
  ])

  it('extracts vendor (ALL CAPS business name)', () => {
    const { data } = parseReceipt(pdfText)
    expect(data.vendor).toBe('TECHDESK SOLUTIONS LTD')
  })

  it('extracts date in DD Mon YYYY format', () => {
    const { data } = parseReceipt(pdfText)
    expect(data.date).toBe('2024-01-14')
  })

  it('extracts total', () => {
    const { data } = parseReceipt(pdfText)
    expect(data.total).toBe(422.98)
  })

  it('extracts VAT amount and rate', () => {
    const { data } = parseReceipt(pdfText)
    expect(data.vatAmount).toBe(70.50)
    expect(data.vatRate).toBe(0.20)
  })

  it('extracts VAT registration number', () => {
    const { data } = parseReceipt(pdfText)
    expect(data.vatNumber).toBe('GB987654321')
  })
})

// ============================================================
// PARSER — extract structured data from raw OCR text
// ============================================================

import type { ReceiptData, VatRate, ExpenseCategory } from './types';

export interface ParseConfidence {
  vendor: 'high' | 'medium' | 'low';
  date: 'high' | 'medium' | 'low';
  total: 'high' | 'medium' | 'low';
  vat: 'high' | 'medium' | 'low';
}

export interface ParseResult {
  data: ReceiptData;
  confidence: ParseConfidence;
}

// ── Currency helpers ─────────────────────────────────────────

/**
 * Like parsePound but tolerates OCR-dropped decimal points.
 * When a 4+ digit string has no decimal point (e.g. "7050" from "£70.50",
 * or "35248" from "£352.48"), the decimal is inserted before the last two
 * digits. 1–3 digit strings are treated as whole pounds (£1–£999) to avoid
 * misinterpreting round amounts like "£100".
 */
export function parsePoundLoose(raw: string): number | null {
  const cleaned = raw.replace(/[£GBP,\s]/gi, '').trim();
  if (!cleaned) return null;

  if (cleaned.includes('.')) {
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
  }

  // No decimal point: 4+ digits → OCR likely dropped it
  if (cleaned.length >= 4) {
    const n = parseFloat(`${cleaned.slice(0, -2)}.${cleaned.slice(-2)}`);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
  }

  // 1–3 digits: treat as whole pounds
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ── Vendor ───────────────────────────────────────────────────

function extractVendor(lines: string[]): { value: string | null; confidence: ParseConfidence['vendor'] } {
  // Heuristic: vendor name is usually in the first 1–4 non-empty lines,
  // often the longest or most prominent.
  const candidates = lines
    .slice(0, 6)
    .map(l => l.trim())
    .filter(l => l.length > 2 && !/^\d/.test(l) && !/^(tel|phone|vat|www|http)/i.test(l));

  if (candidates.length === 0) return { value: null, confidence: 'low' };

  // Prefer lines that look like a business name (title case or ALL CAPS)
  const businessLike = candidates.find(l => /^[A-Z][a-z]/.test(l) || /^[A-Z\s&]+$/.test(l));
  const value = businessLike ?? candidates[0] ?? null;

  return {
    value,
    confidence: businessLike ? 'high' : 'medium',
  };
}

// ── Date ─────────────────────────────────────────────────────

const DATE_PATTERNS: Array<{ re: RegExp; toISO: (m: RegExpMatchArray) => string }> = [
  // DD/MM/YYYY or DD-MM-YYYY
  {
    re: /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/,
    toISO: m => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`,
  },
  // DD/MM/YY
  {
    re: /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})\b/,
    toISO: m => `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`,
  },
  // DD Mon YYYY  e.g. 12 Jan 2024
  {
    re: /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i,
    toISO: m => {
      const months: Record<string, string> = {
        jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
        jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
      };
      return `${m[3]}-${months[m[2].toLowerCase().slice(0,3)]}-${m[1].padStart(2,'0')}`;
    },
  },
  // YYYY-MM-DD (ISO already)
  {
    re: /\b(\d{4})-(\d{2})-(\d{2})\b/,
    toISO: m => `${m[1]}-${m[2]}-${m[3]}`,
  },
];

function extractDate(text: string): { value: string | null; confidence: ParseConfidence['date'] } {
  for (const { re, toISO } of DATE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      try {
        const iso = toISO(m);
        const d = new Date(iso);
        if (!isNaN(d.getTime())) {
          return { value: iso, confidence: 'high' };
        }
      } catch {
        // continue
      }
    }
  }
  return { value: null, confidence: 'low' };
}

// ── Totals & VAT ─────────────────────────────────────────────

// Patterns for total lines — order matters (most specific first).
// Use [^0-9\n]* to skip any qualifier text (including parenthesised labels
// like "(inc. VAT)") between the keyword and the amount.
// Amount group allows an optional decimal so OCR-dropped periods are handled
// by parsePoundLoose at call-site.
// Amount capture group used in total patterns.
// Handles three OCR variants of a decimal number:
//   "422.98"  — normal
//   "42298"   — decimal point dropped entirely (parsePoundLoose recovers it)
//   "422 98"  — decimal point read as a space; [ ][0-9]{2} captures both halves
//               so parsePoundLoose receives "422 98", strips the space → "42298" → 422.98
// The space variant is restricted to exactly 2 digits to avoid capturing unrelated
// numbers that happen to follow a space (e.g. "422 items"), and \b ensures the
// digit pair is word-terminal so "422 984" backtracks to capturing just "422".
const AMT = String.raw`([0-9,]+(?:\.[0-9]+|[ ][0-9]{2})?)\b`;

const TOTAL_LINE_PATTERNS = [
  new RegExp(String.raw`\btotal[^0-9\n]*` + AMT, 'i'),
  new RegExp(String.raw`amount\s+(?:due|paid|tendered)[^0-9\n]*` + AMT, 'i'),
  new RegExp(String.raw`grand\s+total[^0-9\n]*` + AMT, 'i'),
  new RegExp(String.raw`balance\s+due[^0-9\n]*` + AMT, 'i'),
];

const VAT_LINE_PATTERNS = [
  // [^0-9%\n]* between "vat" and "20%" tolerates OCR substitutions like € for @
  // AMT reused here so space-as-decimal is handled for VAT amounts too.
  new RegExp(String.raw`\bvat\b[^0-9%\n]*20%[^0-9\n]*` + AMT, 'i'),
  new RegExp(String.raw`\bvat\b[^0-9%\n]*5%[^0-9\n]*` + AMT, 'i'),
  new RegExp(String.raw`\btax\b[^0-9%\n]*20%[^0-9\n]*` + AMT, 'i'),
  // Tabular VAT summary row — line starts with the rate ("20%") followed by two
  // amounts: the subtotal excl. VAT, then the VAT amount.  The non-capturing
  // group skips the first amount and the second is captured.
  // Example: "20%  £12.04  £2.40"  (Amazon-style invoice VAT table)
  /^[ \t]*20%[^0-9\n]+(?:[0-9,]+\.[0-9]{1,2})[^0-9\n]+([0-9,]+\.[0-9]{1,2})/im,
  // Same layout for reduced 5% rate: "5%  £48.00  £2.40"
  /^[ \t]*5%[^0-9\n]+(?:[0-9,]+\.[0-9]{1,2})[^0-9\n]+([0-9,]+\.[0-9]{1,2})/im,
  /\bvat[\s:£]+([0-9,]+\.[0-9]{1,2})\b/i,   // require decimal on the generic fallback to avoid matching VAT reg numbers
  /\btax[\s:£]+([0-9,]+\.[0-9]{1,2})\b/i,
];

const VAT_NUMBER_RE = /\bvat\s*(?:reg(?:istration)?\s*(?:no\.?|number)?|no\.?|number)?[\s:#]*((?:GB)?\d{9})\b/i;

function extractTotals(text: string): {
  total: number | null;
  vatAmount: number | null;
  subtotal: number | null;
  vatRate: VatRate | null;
  confidence: ParseConfidence['total'];
  vatConfidence: ParseConfidence['vat'];
} {
  let total: number | null = null;
  let totalConfidence: ParseConfidence['total'] = 'low';

  for (const re of TOTAL_LINE_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) {
      total = parsePoundLoose(m[1]);
      totalConfidence = re.source.includes('total') ? 'high' : 'medium';
      if (total !== null) break;
    }
  }

  let vatAmount: number | null = null;
  let vatRate: VatRate | null = null;
  let vatConfidence: ParseConfidence['vat'] = 'low';

  for (const re of VAT_LINE_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) {
      vatAmount = parsePoundLoose(m[1]);
      vatConfidence = 'high';

      // Detect rate from the pattern string itself
      if (re.source.includes('20')) vatRate = 0.20;
      else if (re.source.includes('5')) vatRate = 0.05;
      break;
    }
  }

  // Cross-validate: if vatAmount looks too large relative to total, the decimal
  // was likely dropped (e.g. "7050" captured instead of "70.50"). parsePoundLoose
  // can't know whether a 4-digit number was £70.50 or £70.50 without context,
  // so we re-check here using the total as a reference.
  if (total !== null && vatAmount !== null && vatAmount >= total) {
    const corrected = Math.round(vatAmount) / 100;
    if (corrected < total) vatAmount = corrected;
  }

  // Infer VAT rate from amounts if not explicitly stated
  if (vatAmount !== null && total !== null && vatRate === null) {
    const impliedRate = vatAmount / (total - vatAmount);
    if (Math.abs(impliedRate - 0.20) < 0.02) vatRate = 0.20;
    else if (Math.abs(impliedRate - 0.05) < 0.01) vatRate = 0.05;
    vatConfidence = 'medium';
  }

  // Derive subtotal
  const subtotal =
    total !== null && vatAmount !== null
      ? Math.round((total - vatAmount) * 100) / 100
      : null;

  // Check for zero-rated (VAT number present but no VAT amount)
  const hasVatNumber = VAT_NUMBER_RE.test(text);
  if (hasVatNumber && vatAmount === null) {
    vatRate = 0;
    vatConfidence = 'medium';
  }

  return { total, vatAmount, subtotal, vatRate, confidence: totalConfidence, vatConfidence };
}

function extractVatNumber(text: string): string | null {
  const m = text.match(VAT_NUMBER_RE);
  return m?.[1] ?? null;
}

// ── Category inference ────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<ExpenseCategory, RegExp> = {
  travel:        /\b(train|rail|bus|taxi|uber|lyft|flight|airline|parking|fuel|petrol|diesel|tfl|oyster|eurostar)\b/i,
  meals:         /\b(restaurant|cafe|coffee|food|lunch|dinner|breakfast|eat|meal|pub|bar|starbucks|costa|pret)\b/i,
  accommodation: /\b(hotel|b&b|airbnb|hostel|inn|lodge|motel|accommodation|room)\b/i,
  office:        /\b(stationery|paper|printer|ink|toner|post|stamps|supplies|staples)\b/i,
  equipment:     /\b(laptop|monitor|keyboard|mouse|phone|hardware|cable|desk|chair)\b/i,
  software:      /\b(software|subscription|saas|licence|license|adobe|microsoft|google|aws|cloud)\b/i,
  other:         /.*/,
};

function inferCategory(text: string, vendor: string | null): ExpenseCategory {
  const haystack = `${vendor ?? ''} ${text}`;
  for (const [cat, re] of Object.entries(CATEGORY_KEYWORDS) as [ExpenseCategory, RegExp][]) {
    if (cat === 'other') continue;
    if (re.test(haystack)) return cat;
  }
  return 'other';
}

// ── Main export ───────────────────────────────────────────────

export function parseReceipt(rawText: string): ParseResult {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  const { value: vendor, confidence: vendorConf } = extractVendor(lines);
  const { value: date, confidence: dateConf } = extractDate(rawText);
  const {
    total, vatAmount, subtotal, vatRate,
    confidence: totalConf, vatConfidence,
  } = extractTotals(rawText);
  const vatNumber = extractVatNumber(rawText);
  const category = inferCategory(rawText, vendor);

  const data: ReceiptData = {
    vendor,
    date,
    total,
    subtotal,
    vatAmount,
    vatRate,
    vatNumber,
    category,
    rawText,
  };

  const confidence: ParseConfidence = {
    vendor: vendorConf,
    date: dateConf,
    total: totalConf,
    vat: vatConfidence,
  };

  return { data, confidence };
}

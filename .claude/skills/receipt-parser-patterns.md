---
name: receipt-parser-patterns
description: >
  UK receipt parsing patterns and HMRC VAT rules. Use when modifying
  src/parser.ts, adding new retailer patterns, or debugging extraction
  failures. Contains regex patterns, VAT rate reference, and known
  receipt format variants.
compatibility: No external tools required.
---

# UK Receipt Parser Patterns

## HMRC VAT Rates

| Rate     | Value | When it applies                                                     |
| -------- | ----- | ------------------------------------------------------------------- |
| Standard | 20%   | Most goods and services                                             |
| Reduced  | 5%    | Energy, children's car seats, some home improvements                |
| Zero     | 0%    | Food (not restaurant), books, children's clothing, public transport |

A supplier VAT number (format `GB` + 9 digits, e.g. `GB123456789`) on a receipt does **not** mean the purchase is VAT-rated — small traders below the threshold (£85k) sometimes voluntarily register. A VAT number with no VAT line means zero-rated: set `vatRate = 0`, `vatAmount = null`.

## Regex Patterns in `src/parser.ts`

### Total-line patterns (order matters — most specific first)

```regex
/\btotal[^0-9\n]*([0-9,]+(?:\.[0-9]+)?)\b/i
/amount\s+(?:due|paid|tendered)[^0-9\n]*([0-9,]+(?:\.[0-9]+)?)\b/i
/grand\s+total[^0-9\n]*([0-9,]+(?:\.[0-9]+)?)\b/i
/balance\s+due[^0-9\n]*([0-9,]+(?:\.[0-9]+)?)\b/i
```

### VAT-line patterns

```regex
/\bvat\b[^0-9%\n]*20%[^0-9\n]*([0-9,]+(?:\.[0-9]+)?)\b/i   — explicit 20%
/\bvat\b[^0-9%\n]*5%[^0-9\n]*([0-9,]+(?:\.[0-9]+)?)\b/i    — explicit 5%
/\btax\b[^0-9%\n]*20%[^0-9\n]*([0-9,]+(?:\.[0-9]+)?)\b/i
/\bvat[\s:£]+([0-9,]+\.[0-9]{1,2})\b/i                      — generic fallback (requires decimal to avoid matching VAT reg numbers)
/\btax[\s:£]+([0-9,]+\.[0-9]{1,2})\b/i
```

### VAT number

```
/\bvat\s*(?:reg(?:istration)?\s*(?:no\.?|number)?|no\.?|number)?[\s:#]*((?:GB)?\d{9})\b/i
```

### Date patterns (DD/MM bias — UK receipts)

```text
DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
DD/MM/YY  → assumes 20YY
DD Mon YYYY  (e.g. 12 Jan 2024)
YYYY-MM-DD  (ISO, rarest on receipts)
```

## `parsePoundLoose` — OCR decimal recovery

Thermal printers produce small decimal points that OCR frequently drops. Strategy:

- If the captured string has a `.`, parse normally.
- If it is 4+ digits with no `.`, insert decimal before the last 2 digits (`7050` → `70.50`).
- 1–3 digits with no `.` are treated as whole pounds (`£100`).
- Cross-validation: if `vatAmount >= total`, divide by 100 (decimal was dropped).

## Vendor heuristic

Scan first 6 non-empty lines; skip lines that:

- start with a digit (address numbers, dates)
- start with `tel`, `phone`, `vat`, `www`, `http`

Prefer lines that are title-case (`Costa Coffee`) or ALL CAPS (`TESCO STORES`).

## Category keyword map

```text
travel:        train, rail, bus, taxi, uber, lyft, flight, airline, parking,
               fuel, petrol, diesel, tfl, oyster, eurostar
meals:         restaurant, cafe, coffee, food, lunch, dinner, breakfast, eat,
               meal, pub, bar, starbucks, costa, pret
accommodation: hotel, b&b, airbnb, hostel, inn, lodge, motel, accommodation, room
office:        stationery, paper, printer, ink, toner, post, stamps, supplies, staples
equipment:     laptop, monitor, keyboard, mouse, phone, hardware, cable, desk, chair
software:      software, subscription, saas, licence, license, adobe, microsoft,
               google, aws, cloud
other:         fallback
```

## Known Problem Cases

**Thermal paper receipts:** Small fonts, faded ink, heavy JPEG compression. Preprocessing in `ocr.ts` upscales to ≥1500 px and boosts contrast 40% (ITU-R BT.601 luminance greyscale).

**No-VAT small traders:** Have no `VAT` line at all. Parser returns `vatRate = null`, `vatAmount = null`. The VAT reg pattern guard prevents false positives from address digits.

**Petrol receipts:** May show litre price and `fuel duty` separately. Total-line patterns still work; category keywords (`petrol`, `diesel`, `fuel`) catch the category.

**Multi-page PDFs:** Only page 1 is processed (`pdf.ts` uses `pdfDoc.getPage(1)`). Multi-page receipts may miss data on later pages.

**OCR substitutions:** `€` for `@`, `I` for `1`, `O` for `0`. The VAT-line patterns use `[^0-9%\n]*` between keyword and rate to tolerate substituted characters.

## PDF Text Extraction

- Machine-generated PDFs (Amazon, retailers, accountancy software) have embedded text that `pdf.ts` extracts via `extractPdfText` — no OCR involved, so the output is exact and fast.
- Scanned PDFs contain no embedded text; `pdf.ts` falls back to `pdfToImageBlob`, which renders page 1 to a canvas and returns a Blob for Tesseract to process.
- The same `parser.ts` functions receive the resulting text string in both cases — the PDF source is transparent to the parser.
- Only the first page is processed in either path; data on later pages of multi-page documents is not captured.
- The direct-extraction path avoids all OCR noise (decimal drops, character substitutions), so parser confidence is significantly higher for machine-generated PDFs.

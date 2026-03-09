# Receipt Scanner

A progressive web app for scanning UK business receipts, extracting VAT and totals, and exporting to CSV. Runs entirely in your browser — no images or data leave your device.

## Why this exists

There are established, polished products in this space — Expensify, Dext, ReceiptBank, and others. They are excellent if you have a team, an accountant who wants a feed, or a need for approval workflows.

This is not that.

This is for a sole trader or a two-person company wanting to capture receipts for HMRC purposes and get the numbers into their own spreadsheet. No subscription. No account. No vendor lock-in. No data uploaded to anyone's servers. Just: scan, check, copy CSV, paste into spreadsheet.

The deliberate constraint — no backend, no database, no cloud storage — is a feature, not a limitation. It means:

- **Nothing to pay for.** Hosted on GitHub Pages for free.
- **Nothing to maintain.** No server, no database migrations, no dependency on a third-party API staying alive.
- **Nothing to worry about.** Receipt images and financial data never leave the browser.
- **Nothing to sign up for.** Open the URL, scan a receipt, done.

The trade-off is that OCR runs in the browser via Tesseract.js, which is slower and less accurate than a cloud vision API on difficult images (dark photos, crumpled paper, handwritten receipts). The parsed fields are always shown in an editable form before export precisely because automatic extraction will sometimes be wrong. The human is in the loop.

If you find yourself wanting multi-user access, automatic categorisation, accountant sharing, or integration with Xero/QuickBooks — use one of the established products. That is not the problem this solves.

## Features

- 📷 Camera capture or file upload (JPG, PNG, HEIC, PDF)
- 🔍 In-browser OCR via Tesseract.js (one-time ~10MB download, then cached by the service worker)
- 🇬🇧 UK VAT extraction (20%, 5%, zero-rated), VAT registration number detection
- ✏️ Editable form with confidence indicators — always verify before exporting
- 📋 Copy as CSV or plain text; download CSV for any spreadsheet
- 🌓 Auto dark/light theme (follows OS preference, no toggle needed)
- 📱 Installable PWA — works offline after first visit

## Getting Started

```bash
npm install
npm run dev
```

## Building

```bash
npm run build       # outputs to dist/
npm run preview     # preview the built output locally
npm run typecheck   # type check without building
```

## Deploying to GitHub Pages

1. Push to a GitHub repository
2. Go to **Settings → Pages** and set source to **GitHub Actions**
3. The included `.github/workflows/deploy.yml` handles everything on push to `main`
4. Set the `base` in `vite.config.ts` to your repo name:

   ```ts
   base: "/your-repo-name/";
   ```

## Project Structure

```text
src/
  main.ts      Entry point — event wiring
  ocr.ts       Tesseract.js wrapper
  parser.ts    Receipt parsing (regex heuristics for UK receipts)
  export.ts    CSV generation, clipboard, file download
  ui.ts        DOM manipulation, form population
  types.ts     TypeScript interfaces
  style.css    All styling (cascade layers, design tokens, CSS nesting)
index.html
vite.config.ts
```

## Parser notes

The parser uses regex heuristics — it is not a machine learning model and will not be perfect on all receipts. It handles:

- Vendor name from the first few non-numeric lines
- UK date formats: `DD/MM/YYYY`, `DD/MM/YY`, `DD Mon YYYY`, `YYYY-MM-DD`
- Total / amount due line patterns (multiple variants)
- VAT line items with explicit rate (20%, 5%) or inferred from amounts
- VAT registration numbers in GB format
- Expense category inference from common keywords

Before OCR, images are pre-processed in a canvas: rescaled to at least 1500 px wide and contrast-boosted by ~40%. This significantly reduces the frequency of Tesseract dropping decimal points in currency amounts — a known issue with small fonts on thermal paper. The raw OCR text is always shown so you can see exactly what was extracted and correct any fields manually.

## Known limitations

- **OCR quality** is the main constraint. Tesseract.js performs well on flat, well-lit photos of printed receipts. It degrades on: dark/blurry photos, skewed angles, thermal paper receipts with low contrast, and anything handwritten.
- **Parser accuracy** varies by retailer. Large supermarkets and chains have consistent receipt formats; independent traders less so.
- **Browser-local storage only.** Saved receipts are persisted in `localStorage` so they survive page refreshes and accidental tab closures, but there is no server or cloud sync — clearing browser data or using a different device starts fresh.
- **PDF support** — machine-generated PDFs (Amazon invoices, retailer PDFs, etc.) have their text extracted directly without OCR, which is faster and more accurate. Scanned PDFs fall back to rendering page 1 to a canvas and passing it through Tesseract. Only the first page is processed in either case; multi-page receipts are not fully supported. SVG files are not accepted.
- **Not for VAT returns.** This tool captures and exports data; it does not calculate or file anything.

## Future: Google Drive / Sheets integration

Not yet implemented. When added it will require:

- A Google Cloud project with Drive and Sheets APIs enabled (free)
- An OAuth 2.0 client ID restricted to the Pages domain (public in JS, safe when origin-restricted)
- ~100 lines of JS calling the REST APIs directly using the browser-side GIS token flow
- No backend required

## Disclaimer

**Use at your own risk.**

This tool is a receipt capture aid, not accounting software. HMRC do not mandate specific software for day-to-day record-keeping at the sole trader level — they require that records be accurate and complete. This tool can legitimately form part of that process (scan → verify → export to spreadsheet), but it does not file anything and is not a substitute for professional advice.

Making Tax Digital (MTD) for Income Tax will require compatible software for *submissions* when it applies to you — this tool does not cover that and is not MTD-compatible.

- OCR extraction is imperfect. Always verify every field before using extracted data for any financial, tax, or business purpose.
- The authors accept no liability for errors in extracted data, missed receipts, incorrect VAT figures, or any financial loss arising from use of this tool.
- You are responsible for maintaining accurate and complete records for HMRC and any other relevant authority.
- This tool is not affiliated with or endorsed by HMRC.

If you are unsure whether your record-keeping meets HMRC requirements, speak to an accountant.

## Security notes

No user data leaves the browser, so the attack surface is minimal. One known advisory in the dependency tree is worth noting:

**[GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq)** — `serialize-javascript ≤ 7.0.2` (RCE via RegExp/Date serialisation). This affects `vite-plugin-pwa → workbox-build → @rollup/plugin-terser → serialize-javascript` and is a **build-time only** dependency — nothing vulnerable is shipped to the browser. Mitigated via an `overrides` entry in `package.json` forcing `serialize-javascript ≥ 7.0.3`.

## Licence

MIT — see [LICENSE.txt](./LICENSE.txt).

---

_Scaffolded with [Claude](https://claude.ai) (Anthropic). Reviewed and maintained by humans._

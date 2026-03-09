// ============================================================
// PDF → image conversion using pdf.js
// Renders page 1 of a PDF to a JPEG blob at 2× scale so
// Tesseract gets enough resolution to OCR accurately.
// ============================================================

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

const Y_THRESHOLD   = 3;    // PDF points tolerance for grouping items into the same line
const GAP_THRESHOLD = 4;    // PDF points gap before inserting a space between items
const RENDER_SCALE  = 2.0;  // ~144 dpi for A4 — sufficient for OCR
const JPEG_QUALITY  = 0.92;

// Tell pdf.js where to load its worker. Vite resolves the URL
// at build time and the worker runs in its own thread.
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href;

// Minimal shape of a pdfjs text item that carries rendered text.
// Defined locally to avoid importing from pdfjs internals that may change.
interface PdfTextItem {
  str: string;
  transform: [number, number, number, number, number, number];
  width: number;
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return typeof item === 'object' && item !== null && 'str' in item;
}

/**
 * Attempt to extract embedded text from a machine-generated PDF (page 1 only).
 * Returns null if the PDF contains no extractable text (i.e. it is a scanned image).
 *
 * Text items from pdfjs carry X/Y coordinates in PDF space (origin: bottom-left).
 * We reconstruct reading order by grouping items with similar Y values into lines,
 * sorting each line left-to-right, then inserting spaces at visible horizontal gaps.
 */
export async function extractPdfText(file: File): Promise<string | null> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const { height: pageHeight } = page.getViewport({ scale: 1.0 });

  const content = await page.getTextContent();
  const rawItems = (content.items as unknown[])
    .filter(isPdfTextItem)
    .filter(item => item.str.trim() !== '');

  if (rawItems.length === 0) return null;

  // Flip Y: PDF origin is bottom-left; we want top-to-bottom ordering
  const items = rawItems.map(item => ({
    str:   item.str,
    x:     item.transform[4],
    y:     pageHeight - item.transform[5],
    width: item.width,
  }));

  // Group into lines by Y position
  const lines: (typeof items)[] = [];
  for (const item of items) {
    const line = lines.find(l => Math.abs(l[0].y - item.y) <= Y_THRESHOLD);
    if (line) line.push(item);
    else lines.push([item]);
  }

  // Sort lines top-to-bottom, items within each line left-to-right
  lines.sort((a, b) => a[0].y - b[0].y);
  lines.forEach(l => l.sort((a, b) => a.x - b.x));

  // Join items; insert a space where there is a visible horizontal gap
  return lines
    .map(line =>
      line.reduce<string>((acc, item, i) => {
        if (i === 0) return item.str;
        const gap = item.x - (line[i - 1].x + line[i - 1].width);
        return acc + (gap > GAP_THRESHOLD ? ' ' : '') + item.str;
      }, ''),
    )
    .join('\n');
}

/**
 * Render the first page of a PDF file to a JPEG Blob.
 * Scale 2.0 gives ~144 dpi for a standard A4 PDF — sufficient for OCR.
 */
export async function pdfToImageBlob(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = document.createElement('canvas');
  canvas.width  = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2D context');

  await page.render({ canvasContext: ctx, canvas, viewport }).promise;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

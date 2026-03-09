import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';

const doc = await PDFDocument.create();
const page = doc.addPage([595.28, 841.89]); // A4

const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const regular = await doc.embedFont(StandardFonts.Helvetica);

const black = rgb(0, 0, 0);
const darkGrey = rgb(0.3, 0.3, 0.3);
const lightGrey = rgb(0.6, 0.6, 0.6);

const LEFT = 50;
const RIGHT = 545;
const WIDTH = RIGHT - LEFT;

let y = 800;

// ── Header ────────────────────────────────────────────────────────────────────
page.drawText('TECHDESK SOLUTIONS LTD', {
  x: LEFT,
  y,
  size: 20,
  font: bold,
  color: black,
});

y -= 18;
page.drawText('Unit 4, Innovation Park, Bristol, BS1 5TH', {
  x: LEFT,
  y,
  size: 10,
  font: regular,
  color: darkGrey,
});

y -= 8;
page.drawText('info@techdesksolutions.co.uk  |  +44 (0)117 900 1234', {
  x: LEFT,
  y,
  size: 9,
  font: regular,
  color: lightGrey,
});

// Horizontal rule under header
y -= 10;
page.drawLine({
  start: { x: LEFT, y },
  end: { x: RIGHT, y },
  thickness: 1.5,
  color: black,
});

// ── Invoice label (top-right) ─────────────────────────────────────────────────
page.drawText('INVOICE', {
  x: RIGHT - bold.widthOfTextAtSize('INVOICE', 22),
  y: 800,
  size: 22,
  font: bold,
  color: rgb(0.15, 0.35, 0.65),
});

// ── Invoice metadata ──────────────────────────────────────────────────────────
y -= 20;
const metaLeft = LEFT;
const metaValueX = LEFT + 130;

const metaLines = [
  ['Invoice No:', 'INV-2024-0142'],
  ['Date:', '14 January 2024'],
  ['Due Date:', '14 February 2024'],
  ['Customer:', 'Sunrise Consulting Ltd'],
  ['', '42 Market Street, Bath, BA1 1AB'],
];

for (const [label, value] of metaLines) {
  if (label) {
    page.drawText(label, {
      x: metaLeft,
      y,
      size: 10,
      font: bold,
      color: black,
    });
  }
  page.drawText(value, {
    x: metaValueX,
    y,
    size: 10,
    font: regular,
    color: black,
  });
  y -= 16;
}

// ── Table ─────────────────────────────────────────────────────────────────────
y -= 14;

// Column x positions
const COL_DESC  = LEFT;
const COL_QTY   = LEFT + 270;
const COL_UNIT  = LEFT + 330;
const COL_TOTAL = LEFT + 430;

// Table top border
page.drawLine({
  start: { x: LEFT, y: y + 14 },
  end: { x: RIGHT, y: y + 14 },
  thickness: 1,
  color: black,
});

// Header row labels
const tableHeaders = [
  { text: 'Description',  x: COL_DESC },
  { text: 'Qty',          x: COL_QTY },
  { text: 'Unit Price',   x: COL_UNIT },
  { text: 'Total',        x: COL_TOTAL },
];

for (const h of tableHeaders) {
  page.drawText(h.text, {
    x: h.x,
    y,
    size: 10,
    font: bold,
    color: black,
  });
}

y -= 4;

// Header bottom border
page.drawLine({
  start: { x: LEFT, y },
  end: { x: RIGHT, y },
  thickness: 1,
  color: black,
});

y -= 16;

// Line items
const lineItems = [
  { desc: 'Web Hosting (Annual)',   qty: '1', unit: '£199.99', total: '£199.99' },
  { desc: 'Domain Registration',   qty: '2', unit: '£14.99',  total: '£29.98'  },
  { desc: 'SSL Certificate',       qty: '1', unit: '£49.99',  total: '£49.99'  },
  { desc: 'Technical Support',     qty: '1', unit: '£72.52',  total: '£72.52'  },
];

for (const item of lineItems) {
  page.drawText(item.desc, {
    x: COL_DESC,
    y,
    size: 10,
    font: regular,
    color: black,
  });
  page.drawText(item.qty, {
    x: COL_QTY,
    y,
    size: 10,
    font: regular,
    color: black,
  });
  page.drawText(item.unit, {
    x: COL_UNIT,
    y,
    size: 10,
    font: regular,
    color: black,
  });
  page.drawText(item.total, {
    x: COL_TOTAL,
    y,
    size: 10,
    font: regular,
    color: black,
  });
  y -= 18;
}

// Table bottom border
y -= 4;
page.drawLine({
  start: { x: LEFT, y },
  end: { x: RIGHT, y },
  thickness: 1,
  color: black,
});

// ── Subtotals ─────────────────────────────────────────────────────────────────
y -= 18;

const subtotalLabelX = COL_TOTAL - 140;
const subtotalValueX = RIGHT - regular.widthOfTextAtSize('£422.98', 10); // right-align

const subtotals = [
  { label: 'Subtotal (ex. VAT):',  value: '£352.48', isBold: false },
  { label: 'VAT @ 20%:',           value: '£70.50',  isBold: false },
  { label: 'TOTAL:',               value: '£422.98', isBold: true  },
];

for (const row of subtotals) {
  const font = row.isBold ? bold : regular;
  const size = row.isBold ? 11 : 10;

  if (row.isBold) {
    // Separator line above TOTAL
    page.drawLine({
      start: { x: subtotalLabelX, y: y + 14 },
      end: { x: RIGHT, y: y + 14 },
      thickness: 0.75,
      color: black,
    });
  }

  page.drawText(row.label, {
    x: subtotalLabelX,
    y,
    size,
    font,
    color: black,
  });

  const valueWidth = font.widthOfTextAtSize(row.value, size);
  page.drawText(row.value, {
    x: RIGHT - valueWidth,
    y,
    size,
    font,
    color: black,
  });

  y -= row.isBold ? 20 : 16;
}

// ── Payment terms ─────────────────────────────────────────────────────────────
y -= 16;
page.drawText('Payment Terms', {
  x: LEFT,
  y,
  size: 10,
  font: bold,
  color: black,
});

y -= 14;
page.drawText('Payment due within 30 days of invoice date. Bank transfer preferred.', {
  x: LEFT,
  y,
  size: 9,
  font: regular,
  color: darkGrey,
});

y -= 12;
page.drawText('Sort Code: 40-12-34   Account No: 87654321   Bank: Lloyds Bank plc', {
  x: LEFT,
  y,
  size: 9,
  font: regular,
  color: darkGrey,
});

// ── Footer ────────────────────────────────────────────────────────────────────
const footerY = 40;

page.drawLine({
  start: { x: LEFT, y: footerY + 14 },
  end: { x: RIGHT, y: footerY + 14 },
  thickness: 0.75,
  color: lightGrey,
});

page.drawText('VAT Registration Number: GB987654321', {
  x: LEFT,
  y: footerY,
  size: 9,
  font: regular,
  color: darkGrey,
});

page.drawText('Company No: 09876543  |  Registered in England & Wales', {
  x: LEFT,
  y: footerY - 12,
  size: 8,
  font: regular,
  color: lightGrey,
});

// ── Save ──────────────────────────────────────────────────────────────────────
const outputPath = 'public/examples/invoice-example.pdf';
mkdirSync('public/examples', { recursive: true });

const pdfBytes = await doc.save();
writeFileSync(outputPath, pdfBytes);

console.log(`PDF written to ${outputPath} (${pdfBytes.byteLength} bytes)`);

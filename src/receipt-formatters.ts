// ============================================================
// RECEIPT FORMATTERS — CSV and plain-text formatting
// ============================================================

import type { ReceiptData } from './types';

const CSV_HEADERS = [
  'Date',
  'Vendor',
  'Category',
  'Total (£)',
  'Subtotal (£)',
  'VAT Amount (£)',
  'VAT Rate',
  'VAT Number',
] as const;

function escapeCell(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Wrap in quotes if contains comma, newline, or quote
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatVatRate(rate: number | null): string {
  if (rate === null) return '';
  return `${Math.round(rate * 100)}%`;
}

/**
 * Build a CSV string from a single receipt.
 */
export function receiptToCSVRow(data: ReceiptData): string {
  const cells = [
    data.date ?? '',
    data.vendor ?? '',
    data.category ?? '',
    data.total !== null ? data.total.toFixed(2) : '',
    data.subtotal !== null ? data.subtotal.toFixed(2) : '',
    data.vatAmount !== null ? data.vatAmount.toFixed(2) : '',
    formatVatRate(data.vatRate),
    data.vatNumber ?? '',
  ];
  return cells.map(escapeCell).join(',');
}

export function buildCSV(rows: ReceiptData[]): string {
  const header = CSV_HEADERS.join(',');
  const dataRows = rows.map(receiptToCSVRow);
  return [header, ...dataRows].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(rows: ReceiptData[], filename = 'receipts.csv'): void {
  downloadFile(buildCSV(rows), filename, 'text/csv;charset=utf-8;');
}

/**
 * Format receipt as plain text summary (for display / manual copy).
 */
export function receiptToText(data: ReceiptData): string {
  const lines: string[] = [
    `Vendor:      ${data.vendor ?? '—'}`,
    `Date:        ${data.date ?? '—'}`,
    `Category:    ${data.category ?? '—'}`,
    `─────────────────────────`,
    `Total:       £${data.total?.toFixed(2) ?? '—'}`,
    `Subtotal:    £${data.subtotal?.toFixed(2) ?? '—'}`,
    `VAT:         £${data.vatAmount?.toFixed(2) ?? '—'} (${formatVatRate(data.vatRate)})`,
    data.vatNumber ? `VAT No:      ${data.vatNumber}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

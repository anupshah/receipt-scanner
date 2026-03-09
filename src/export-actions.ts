// ============================================================
// EXPORT ACTIONS — save, copy, download button wiring + history
// ============================================================

import { buildCSV, receiptToText, downloadCSV } from './receipt-formatters';
import { readForm, showToast } from './ui';
import type { ReceiptData } from './types';

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for older browsers
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

let receiptHistory: ReceiptData[] = [];

function updateHistoryCount(): void {
  const counter = document.getElementById('history-count');
  if (counter) {
    const n = receiptHistory.length;
    counter.textContent = String(n);
    counter.setAttribute('aria-label', `${n} receipt${n !== 1 ? 's' : ''} saved`);
  }
}

export function wireExportActions(): void {
  // Save receipt to history
  document.getElementById('save-btn')?.addEventListener('click', () => {
    const data = readForm();
    receiptHistory.push(data);
    showToast(`Receipt saved (${receiptHistory.length} total)`, 'success');
    updateHistoryCount();
  });

  // Copy CSV of current receipt
  document.getElementById('copy-csv-btn')?.addEventListener('click', async () => {
    const csv = buildCSV([readForm()]);
    try {
      await copyToClipboard(csv);
      showToast('CSV copied to clipboard', 'success');
    } catch {
      showToast('Copy failed — try the download button', 'error');
    }
  });

  // Copy plain text of current receipt
  document.getElementById('copy-text-btn')?.addEventListener('click', async () => {
    try {
      await copyToClipboard(receiptToText(readForm()));
      showToast('Text copied to clipboard', 'success');
    } catch {
      showToast('Copy failed', 'error');
    }
  });

  // Download CSV of all saved receipts (or current form if none saved)
  document.getElementById('download-csv-btn')?.addEventListener('click', () => {
    if (receiptHistory.length === 0) {
      downloadCSV([readForm()]);
    } else {
      downloadCSV(receiptHistory);
      showToast(`Downloaded CSV with ${receiptHistory.length} receipt(s)`, 'success');
    }
  });

  // Raw OCR text toggle
  document.getElementById('raw-toggle-btn')?.addEventListener('click', () => {
    const raw = document.getElementById('raw-text-section') as HTMLElement;
    const btn = document.getElementById('raw-toggle-btn') as HTMLButtonElement;
    const isHidden = raw.hasAttribute('hidden');
    if (isHidden) {
      raw.removeAttribute('hidden');
      raw.setAttribute('aria-hidden', 'false');
      btn.textContent = 'Hide raw text';
    } else {
      raw.setAttribute('hidden', '');
      raw.setAttribute('aria-hidden', 'true');
      btn.textContent = 'Show raw OCR text';
    }
  });
}

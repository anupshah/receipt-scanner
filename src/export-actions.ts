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

const STORAGE_KEY = 'receipt-scanner:history';

function loadHistory(): ReceiptData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReceiptData[]) : [];
  } catch {
    return [];
  }
}

function persistHistory(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receiptHistory));
  } catch {
    // localStorage full or unavailable — silent fail, data still in memory
  }
}

function clearPersistedHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silent fail
  }
}

let receiptHistory: ReceiptData[] = loadHistory();

function updateHistoryUI(): void {
  const n = receiptHistory.length;
  const label = `${n} receipt${n !== 1 ? 's' : ''} saved`;

  const countEl = document.querySelector('#history-count .history-pill__count');
  const pillBtn = document.getElementById('history-count');
  if (countEl) countEl.textContent = String(n);
  if (pillBtn) pillBtn.setAttribute('aria-label', label);

  const status = document.getElementById('history-popover-status');
  const hint = document.getElementById('history-popover-hint');
  const actions = document.getElementById('history-popover-actions');

  if (status) {
    status.textContent = n === 0
      ? 'No receipts saved yet.'
      : `${n} receipt${n !== 1 ? 's' : ''} queued for export.`;
  }
  if (hint) {
    hint.innerHTML = n === 0
      ? 'Scan a receipt, review the fields, then hit <strong>Save Receipt</strong> to queue it here. When you\'re done, download everything as a single CSV.'
      : 'Download all saved receipts as one CSV file, or clear the queue to start over.';
  }

  const table = document.getElementById('history-popover-table');
  const tbody = document.getElementById('history-popover-tbody');
  const totalCell = document.getElementById('history-popover-total');
  if (table && tbody && totalCell) {
    if (n === 0) {
      table.setAttribute('hidden', '');
      tbody.innerHTML = '';
    } else {
      table.removeAttribute('hidden');
      tbody.innerHTML = '';
      let runningTotal = 0;
      for (const r of receiptHistory) {
        const tr = document.createElement('tr');
        const vendorTd = document.createElement('td');
        vendorTd.textContent = r.vendor || 'Unknown';
        const totalTd = document.createElement('td');
        totalTd.className = 'history-popover__amount text-end';
        const amount = r.total ?? 0;
        runningTotal += amount;
        totalTd.textContent = `£${amount.toFixed(2)}`;
        tr.append(vendorTd, totalTd);
        tbody.appendChild(tr);
      }
      totalCell.textContent = `£${runningTotal.toFixed(2)}`;
    }
  }

  if (actions) {
    if (n > 0) actions.removeAttribute('hidden');
    else actions.setAttribute('hidden', '');
  }
}

export function wireExportActions(): void {
  // Save receipt to history
  document.getElementById('save-btn')?.addEventListener('click', () => {
    const data = readForm();
    receiptHistory.push(data);
    persistHistory();
    showToast(`Receipt saved (${receiptHistory.length} total)`, 'success');
    updateHistoryUI();
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

  // Popover: download CSV
  document.getElementById('popover-download-btn')?.addEventListener('click', () => {
    if (receiptHistory.length > 0) {
      downloadCSV(receiptHistory);
      showToast(`Downloaded CSV with ${receiptHistory.length} receipt(s)`, 'success');
      (document.getElementById('history-popover') as HTMLElement)?.hidePopover();
    }
  });

  // Popover: copy CSV to clipboard
  document.getElementById('popover-copy-btn')?.addEventListener('click', async () => {
    if (receiptHistory.length > 0) {
      const csv = buildCSV(receiptHistory);
      try {
        await copyToClipboard(csv);
        showToast('CSV copied to clipboard', 'success');
      } catch {
        showToast('Copy failed — try the download button', 'error');
      }
      (document.getElementById('history-popover') as HTMLElement)?.hidePopover();
    }
  });

  // Popover: clear saved receipts
  document.getElementById('popover-clear-btn')?.addEventListener('click', () => {
    receiptHistory = [];
    clearPersistedHistory();
    updateHistoryUI();
    showToast('Saved receipts cleared', 'success');
    (document.getElementById('history-popover') as HTMLElement)?.hidePopover();
  });

  // Restore any persisted history into the UI on load
  receiptHistory = loadHistory();
  updateHistoryUI();

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

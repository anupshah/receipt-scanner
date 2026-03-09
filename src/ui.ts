// ============================================================
// UI — DOM helpers, form population, status display
// ============================================================

import type { ReceiptData } from './types';
import { VAT_RATE_LABELS, EXPENSE_CATEGORIES } from './types';
import type { OcrStatus } from './ocr';
import type { ParseConfidence } from './parser';

const TOAST_DURATION_MS    = 3000; // how long toasts stay visible
const STATUS_HIDE_DELAY_MS = 1500; // delay before hiding OCR status bar after completion

// ── Typed element getters ─────────────────────────────────────

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} not found`);
  return e as T;
}

function input(id: string): HTMLInputElement {
  return el<HTMLInputElement>(id);
}

function select(id: string): HTMLSelectElement {
  return el<HTMLSelectElement>(id);
}

// ── Section visibility ────────────────────────────────────────

export function showSection(id: string): void {
  el(id).removeAttribute('hidden');
  el(id).setAttribute('aria-hidden', 'false');
}

export function hideSection(id: string): void {
  el(id).setAttribute('hidden', '');
  el(id).setAttribute('aria-hidden', 'true');
}

// ── OCR status ────────────────────────────────────────────────

export function updateStatus(status: OcrStatus): void {
  const region = el('ocr-status');
  const bar = el<HTMLProgressElement>('ocr-progress');
  const text = el('ocr-status-text');

  region.removeAttribute('hidden');

  switch (status.phase) {
    case 'idle':
      region.setAttribute('hidden', '');
      break;
    case 'loading':
      text.textContent = 'Loading OCR engine…';
      bar.removeAttribute('value'); // indeterminate
      break;
    case 'processing':
      text.textContent = `Recognising text… ${status.progress}%`;
      bar.value = status.progress;
      bar.max = 100;
      break;
    case 'done':
      text.textContent = 'Recognition complete.';
      bar.value = 100;
      setTimeout(() => region.setAttribute('hidden', ''), STATUS_HIDE_DELAY_MS);
      break;
    case 'error':
      text.textContent = `Error: ${status.message}`;
      region.classList.add('status--error');
      break;
  }
}

// ── Confidence badge ──────────────────────────────────────────

function setBadge(fieldId: string, confidence: 'high' | 'medium' | 'low'): void {
  const badge = document.querySelector(`[data-badge="${fieldId}"]`);
  if (!badge) return;
  badge.setAttribute('data-confidence', confidence);
  badge.textContent = confidence === 'high' ? '✓' : confidence === 'medium' ? '~' : '?';
  badge.setAttribute('title', `Confidence: ${confidence}`);
  badge.setAttribute('aria-label', `Parse confidence: ${confidence}`);
}

// ── Populate form ─────────────────────────────────────────────

export function populateForm(data: ReceiptData, confidence: ParseConfidence): void {
  input('field-vendor').value = data.vendor ?? '';
  input('field-date').value = data.date ?? '';
  input('field-total').value = data.total !== null ? data.total.toFixed(2) : '';
  input('field-subtotal').value = data.subtotal !== null ? data.subtotal.toFixed(2) : '';
  input('field-vat-amount').value = data.vatAmount !== null ? data.vatAmount.toFixed(2) : '';
  input('field-vat-number').value = data.vatNumber ?? '';

  // VAT rate select
  const vatRateEl = select('field-vat-rate');
  vatRateEl.innerHTML = '';
  const blankOpt = new Option('— select —', '');
  vatRateEl.appendChild(blankOpt);
  for (const [rateStr, label] of Object.entries(VAT_RATE_LABELS)) {
    const opt = new Option(label, rateStr);
    if (data.vatRate !== null && parseFloat(rateStr) === data.vatRate) {
      opt.selected = true;
    }
    vatRateEl.appendChild(opt);
  }

  // Category select
  const catEl = select('field-category');
  catEl.innerHTML = '';
  for (const cat of EXPENSE_CATEGORIES) {
    const opt = new Option(cat.charAt(0).toUpperCase() + cat.slice(1), cat);
    if (data.category === cat) opt.selected = true;
    catEl.appendChild(opt);
  }

  // Raw text
  el('raw-text').textContent = data.rawText;

  // Confidence badges
  setBadge('vendor', confidence.vendor);
  setBadge('date', confidence.date);
  setBadge('total', confidence.total);
  setBadge('vat-amount', confidence.vat);

  showSection('results-section');
}

// ── Read form back to ReceiptData ─────────────────────────────

export function readForm(): ReceiptData {
  const vatRateRaw = select('field-vat-rate').value;
  const vatRate = vatRateRaw !== '' ? (parseFloat(vatRateRaw) as 0 | 0.05 | 0.20) : null;

  const parseNum = (id: string): number | null => {
    const v = input(id).value.trim();
    const n = parseFloat(v);
    return v === '' || isNaN(n) ? null : Math.round(n * 100) / 100;
  };

  return {
    vendor: input('field-vendor').value.trim() || null,
    date: input('field-date').value || null,
    total: parseNum('field-total'),
    subtotal: parseNum('field-subtotal'),
    vatAmount: parseNum('field-vat-amount'),
    vatRate,
    vatNumber: input('field-vat-number').value.trim() || null,
    category: (select('field-category').value as ReceiptData['category']) || null,
    rawText: el('raw-text').textContent ?? '',
  };
}

// ── Image preview ─────────────────────────────────────────────

export function showImagePreview(source: File | Blob): void {
  const img = el<HTMLImageElement>('receipt-preview');
  img.src = URL.createObjectURL(source);
  img.alt = source instanceof File ? `Preview of ${source.name}` : 'Receipt preview';
  showSection('preview-section');
}

// ── Toast notifications ───────────────────────────────────────

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const container = el('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, TOAST_DURATION_MS);
}

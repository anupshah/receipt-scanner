// ============================================================
// PIPELINE — async scan orchestration (file → OCR → parse → form)
// ============================================================

import { recogniseImage } from './ocr';
import type { OcrStatus } from './ocr';
import { extractPdfText, pdfToImageBlob } from './pdf';
import { parseReceipt } from './parser';
import { populateForm, showImagePreview, updateStatus, showToast, hideSection } from './ui';

export function setProcessing(busy: boolean): void {
  const btn = document.getElementById('scan-btn') as HTMLButtonElement;
  const dropzone = document.getElementById('dropzone') as HTMLElement;
  btn.disabled = busy;
  btn.setAttribute('aria-busy', String(busy));
  dropzone.setAttribute('aria-disabled', String(busy));
}

export async function scanReceipt(file: File): Promise<void> {
  setProcessing(true);
  hideSection('results-section');
  hideSection('preview-section');
  (document.getElementById('examples-details') as HTMLDetailsElement | null)?.removeAttribute('open');

  try {
    const onProgress = (s: OcrStatus) => updateStatus(s);
    let rawText: string;

    if (file.type === 'application/pdf') {
      // Render first page and extract text in parallel — raster is used for
      // preview in both cases, and for OCR input if text extraction returns null.
      const [extracted, raster] = await Promise.all([
        extractPdfText(file),
        pdfToImageBlob(file),
      ]);
      showImagePreview(raster);
      if (extracted !== null) {
        rawText = extracted;
        onProgress({ phase: 'done' });
      } else {
        rawText = await recogniseImage(raster, onProgress);
      }
    } else {
      // Image file: show preview immediately, then OCR
      showImagePreview(file);
      rawText = await recogniseImage(file, onProgress);
    }

    const { data, confidence } = parseReceipt(rawText);
    populateForm(data, confidence);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    updateStatus({ phase: 'error', message });
    showToast(`Scan failed: ${message}`, 'error');
  } finally {
    setProcessing(false);
  }
}

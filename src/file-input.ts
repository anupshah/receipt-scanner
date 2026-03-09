// ============================================================
// FILE INPUT — file selection, drag-and-drop, keyboard access
// ============================================================

import { showToast } from './ui';

export function wireFileInput(onFile: (file: File) => void): void {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const scanBtn   = document.getElementById('scan-btn')   as HTMLButtonElement;
  const dropzone  = document.getElementById('dropzone')   as HTMLElement;

  scanBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) onFile(file);
    fileInput.value = ''; // allow re-selecting same file
  });

  // Drag & drop
  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.setAttribute('data-drag', 'over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.removeAttribute('data-drag');
  });

  dropzone.addEventListener('drop', async e => {
    e.preventDefault();
    dropzone.removeAttribute('data-drag');

    const file = e.dataTransfer?.files[0];
    if (file) {
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        onFile(file);
      } else {
        showToast('Please drop an image or PDF file', 'error');
      }
      return;
    }

    // Handle example cards dragged into the dropzone (carry a URL)
    const url = e.dataTransfer?.getData('text/uri-list');
    if (url) {
      try {
        const resp = await fetch(url);
        const blob = await resp.blob();
        const name = url.split('/').pop() ?? 'receipt';
        onFile(new File([blob], name, { type: blob.type }));
      } catch {
        showToast('Could not load example file', 'error');
      }
    }
  });

  // Click anywhere on the dropzone (excluding the button itself)
  dropzone.addEventListener('click', e => {
    if (e.target === scanBtn || scanBtn.contains(e.target as Node)) return;
    fileInput.click();
  });

  // Keyboard accessibility for dropzone
  dropzone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
}

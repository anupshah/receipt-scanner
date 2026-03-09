// ============================================================
// MAIN — entry point, event wiring
// ============================================================

import { scanReceipt } from './pipeline';
import { wireFileInput } from './file-input';
import { wireExportActions } from './export-actions';
import { wireVatCalculations } from './vat-calculator';
import { wirePwaInstall } from './pwa-install';
import { showToast } from './ui';

// ── Example receipts ──────────────────────────────────────────

function wireExamples(): void {
  const cards = document.querySelectorAll<HTMLButtonElement>('.example-card');

  cards.forEach(card => {
    const src  = card.dataset['src']  ?? '';
    const name = card.dataset['name'] ?? 'receipt';
    const type = card.dataset['type'] ?? 'application/octet-stream';

    // Click → fetch and scan
    card.addEventListener('click', async () => {
      card.setAttribute('aria-busy', 'true');
      try {
        const resp = await fetch(src);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        void scanReceipt(new File([blob], name, { type }));
      } catch {
        showToast('Could not load example file', 'error');
      } finally {
        card.setAttribute('aria-busy', 'false');
      }
    });

    // Drag → expose URL so dropzone can fetch it
    card.addEventListener('dragstart', e => {
      const absolute = new URL(src, window.location.href).href;
      e.dataTransfer?.setData('text/uri-list', absolute);
      e.dataTransfer?.setData('text/plain', absolute);
    });
  });
}

// ── Bootstrap ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  wireFileInput(file => void scanReceipt(file));
  wireExportActions();
  wireVatCalculations();
  wireExamples();
  wirePwaInstall();
});

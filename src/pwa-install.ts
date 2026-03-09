// ============================================================
// PWA INSTALL — deferred install prompt handling
// ============================================================

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

export function wirePwaInstall(): void {
  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  const installBtn = document.getElementById('install-btn') as HTMLButtonElement | null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installBtn?.removeAttribute('hidden');
  });

  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    deferredPrompt = null;
    installBtn.setAttribute('hidden', '');
  });
}

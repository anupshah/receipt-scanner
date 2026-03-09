---
name: pwa-patterns
description: >
  PWA patterns for Vite + vite-plugin-pwa projects. Use when modifying
  vite.config.ts, service worker behaviour, caching strategies, or
  debugging PWA install prompts. Covers iOS Safari limitations,
  BeforeInstallPromptEvent, and Workbox configuration.
compatibility: Vite 7, vite-plugin-pwa 1.x
---

# PWA Patterns for Receipt Scanner

## Stack

- **Vite 7** with `base: '/'` (change to `'/repo-name/'` for GitHub Pages)
- **vite-plugin-pwa 1.x** — generates service worker via Workbox
- **vite-plugin-mkcert** — local HTTPS (required for camera, SW, install prompt)
- `registerType: 'autoUpdate'` — SW updates silently on new deploy

## Workbox Configuration (`vite.config.ts`)

### `maximumFileSizeToCacheInBytes: 15 * 1024 * 1024`

Tesseract.js WASM and language data files are several MB each. The Workbox default cap is 2 MB, which would silently exclude them from the precache. This is raised to 15 MB so offline OCR works. Do not lower this.

### Glob patterns

```ts
globPatterns: ["**/*.{js,css,html,ico,png,jpg,svg,woff2}"];
```

Covers all precached assets. WASM files (`.wasm`) are not listed because Tesseract loads them at runtime via its own fetch; they hit the runtime cache instead.

### Runtime cache — Tesseract assets

```ts
{
  urlPattern: /tesseract/,
  handler: 'CacheFirst',
  options: {
    cacheName: 'tesseract-cache',
    expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
  },
}
```

`CacheFirst` is correct here: Tesseract language data never changes between app versions. `NetworkFirst` would waste bandwidth and fail offline.

## `base` Path Must Match Everywhere

When deploying to GitHub Pages, the `base` in `vite.config.ts` must match the `scope` and `start_url` in the PWA manifest. Both must be `'/receipt-scanner/'`. This is already set:

```ts
base: '/receipt-scanner/',
```

## iOS Safari Limitations

- **No `beforeinstallprompt` event** — iOS Safari never fires it. The install button (`#install-btn`) will remain hidden on iOS. Users must install via Share sheet → "Add to Home Screen".
- **No push notifications** without explicit permission (iOS 16.4+ only, home screen PWA only).
- **`standalone` display mode** works on iOS — the app launches without browser chrome.
- **Camera access** requires HTTPS (`mkcert` covers local dev).

## Install Prompt Pattern (Chrome/Android)

```ts
// Extend Window for the non-standard event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // stop browser's default mini-infobar
  deferredPrompt = e as BeforeInstallPromptEvent;
  installBtn?.removeAttribute("hidden");
});

installBtn?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  deferredPrompt = null;
  installBtn.setAttribute("hidden", "");
});
```

## `CacheFirst` vs `NetworkFirst` Decision Guide

| Asset type                 | Strategy        | Reason                                   |
| -------------------------- | --------------- | ---------------------------------------- |
| Tesseract WASM / lang data | `CacheFirst`    | Large, versioned, never changes in-place |
| App shell (JS/CSS/HTML)    | Precache (auto) | Vite hashes filenames; always fresh      |
| Example receipt images     | Precache        | Small, static                            |
| External fonts             | `CacheFirst`    | Versioned by CDN                         |
| API calls (none currently) | `NetworkFirst`  | Would need freshness                     |

## Offline Behaviour

The entire app works offline after first load:

- OCR engine + language data cached under `tesseract-cache`
- App shell precached by Workbox
- No network calls except the initial load and Tesseract language fetch

## Build & Deploy

```bash
npm run build          # type-check + Vite build → dist/
# dist/ contains: index.html, assets/, sw.js, manifest.webmanifest, icons/
```

Push to `main` → GitHub Actions deploys to Pages automatically (see `.github/workflows/`).
Before first deploy: set `base: '/your-repo-name/'` in `vite.config.ts`.

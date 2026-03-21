// ============================================================
// OCR — Tesseract.js wrapper
// ============================================================

import { createWorker, type Worker } from "tesseract.js";

export type OcrStatus =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'processing'; progress: number }
  | { phase: 'done' }
  | { phase: 'error'; message: string };

const MIN_WIDTH = 1500; // upscale images narrower than this before OCR
const MAX_WIDTH = 3000; // downscale images wider than this (saves memory)
const CONTRAST = 1.5; // contrast multiplication factor for greyscale boost
const LEVEL_LO_PCT = 1; // percentile for auto-levels black point
const LEVEL_HI_PCT = 99; // percentile for auto-levels white point

let worker: Worker | null = null;

// ── Image pre-processing ──────────────────────────────────────

/**
 * Pre-process an image blob before passing it to Tesseract.
 *
 * Tesseract's LSTM model is trained on general text. Receipts — especially
 * thermal paper — have small fonts and tiny punctuation (decimal points,
 * commas) that get lost at low resolution or with JPEG compression artifacts.
 * Three steps give the biggest improvement:
 *
 *   1. Normalise size  — scale up small images to ≥ 1500 px wide; cap large
 *      images at 3000 px wide (saves memory without hurting recognition).
 *   2. Greyscale + auto-levels + contrast boost — converts colour to
 *      luminance, stretches the histogram so the actual paper maps to white
 *      and ink to black (compensating for warm lighting, shadows, etc.), then
 *      applies an additional contrast boost.
 *   3. Sharpen — a 3×3 convolution kernel crisps up text edges, recovering
 *      detail lost to camera softness or JPEG compression. This is the main
 *      thing messaging apps like WhatsApp add that improves OCR results.
 *
 * Output is a lossless PNG so no re-compression artifacts are introduced.
 * Falls back to the original blob if canvas is unavailable.
 */
async function preprocessForOcr(blob: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob; // unsupported format — let Tesseract try anyway
  }

  const rawW = bitmap.width;
  const targetW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, rawW));
  const scale = targetW / rawW;

  const canvas = document.createElement("canvas");
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }

  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const pixelCount = w * h;

  // ── Pass 1: convert to greyscale and build histogram ──────
  const grey = new Float32Array(pixelCount);
  const histogram = new Uint32Array(256);

  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    // Luminance-weighted greyscale (ITU-R BT.601)
    const g = 0.299 * d[off] + 0.587 * d[off + 1] + 0.114 * d[off + 2];
    grey[i] = g;
    histogram[Math.round(g)]++;
  }

  // ── Auto-levels: find 1st and 99th percentile luminance ───
  const loTarget = Math.floor(pixelCount * LEVEL_LO_PCT / 100);
  const hiTarget = Math.ceil(pixelCount * LEVEL_HI_PCT / 100);
  let cumulative = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative <= loTarget) lo = v;
    if (cumulative < hiTarget) hi = v;
  }
  // Avoid division by zero for flat images
  const range = Math.max(1, hi - lo);

  // ── Pass 2: auto-levels + contrast boost ──────────────────
  for (let i = 0; i < pixelCount; i++) {
    // Stretch to full 0–255 range based on percentile bounds
    const levelled = ((grey[i] - lo) / range) * 255;
    const clamped = Math.max(0, Math.min(255, levelled));
    // Contrast boost around midpoint
    grey[i] = Math.max(0, Math.min(255, 128 + (clamped - 128) * CONTRAST));
  }

  // ── Pass 3: sharpen (3×3 kernel) ──────────────────────────
  // Kernel:  0 -1  0
  //         -1  5 -1
  //          0 -1  0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const sharp =
        5 * grey[idx] -
        grey[idx - 1] - grey[idx + 1] -
        grey[idx - w] - grey[idx + w];
      const val = Math.max(0, Math.min(255, Math.round(sharp)));
      const off = idx * 4;
      d[off] = d[off + 1] = d[off + 2] = val;
    }
  }

  // Fill border pixels (untouched by 3×3 kernel) with the levelled values
  for (let x = 0; x < w; x++) {
    const topOff = x * 4;
    const botOff = ((h - 1) * w + x) * 4;
    d[topOff] = d[topOff + 1] = d[topOff + 2] = Math.round(grey[x]);
    d[botOff] = d[botOff + 1] = d[botOff + 2] = Math.round(grey[(h - 1) * w + x]);
  }
  for (let y = 1; y < h - 1; y++) {
    const leftOff = (y * w) * 4;
    const rightOff = (y * w + w - 1) * 4;
    d[leftOff] = d[leftOff + 1] = d[leftOff + 2] = Math.round(grey[y * w]);
    d[rightOff] = d[rightOff + 1] = d[rightOff + 2] = Math.round(grey[y * w + w - 1]);
  }

  ctx.putImageData(img, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Pre-process toBlob failed"))),
      "image/png",
    );
  });
}

/**
 * Initialise (or reuse) the Tesseract worker.
 * Language data is fetched once and cached by the service worker.
 */
async function getWorker(
  onProgress: (status: OcrStatus) => void,
): Promise<Worker> {
  if (worker) return worker;

  onProgress({ phase: "loading" });

  // Language passed directly to createWorker; no separate
  // loadLanguage/initialize calls needed.
  worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress({
          phase: "processing",
          progress: Math.round(m.progress * 100),
        });
      }
    },
  });

  return worker;
}

/**
 * Run OCR on an image file or blob.
 * Returns the raw recognised text.
 */
export async function recogniseImage(
  image: File | Blob,
  onProgress: (status: OcrStatus) => void,
): Promise<string> {
  const w = await getWorker(onProgress);
  onProgress({ phase: "processing", progress: 0 });

  // Upscale + contrast-boost before recognition to reduce decimal-point drops.
  // PDF-to-raster conversion (if needed) is handled by the caller before this point.
  const input = await preprocessForOcr(image);

  const { data } = await w.recognize(input);

  onProgress({ phase: "done" });
  return data.text;
}

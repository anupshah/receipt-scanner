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
const CONTRAST = 1.4; // contrast multiplication factor for greyscale boost

let worker: Worker | null = null;

// ── Image pre-processing ──────────────────────────────────────

/**
 * Pre-process an image blob before passing it to Tesseract.
 *
 * Tesseract's LSTM model is trained on general text. Receipts — especially
 * thermal paper — have small fonts and tiny punctuation (decimal points,
 * commas) that get lost at low resolution or with JPEG compression artifacts.
 * Two steps give the biggest improvement:
 *
 *   1. Normalise size  — scale up small images to ≥ 1500 px wide; cap large
 *      images at 3000 px wide (saves memory without hurting recognition).
 *   2. Greyscale + contrast boost — converts colour to luminance and widens
 *      the tonal range by 40 %, making dark ink on pale paper crisper and
 *      preventing pale decimal points from disappearing into the background.
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
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Greyscale conversion + 40% contrast boost
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    // Luminance-weighted greyscale (ITU-R BT.601)
    const grey = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const boosted = Math.max(0, Math.min(255, 128 + (grey - 128) * CONTRAST));
    d[i] = d[i + 1] = d[i + 2] = boosted;
    // alpha (d[i+3]) unchanged
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

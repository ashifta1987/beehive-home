"use client";

import { MAX_PHOTO_BYTES } from "./checkin-schema";

type Drawable = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function load(file: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img>, which some browsers decode more formats with
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Resize a photo on the phone to at most `max` px on the long side and encode it as
 * JPEG (~0.8), stepping the quality down until it fits the 5 MB upload limit.
 */
export async function compressImage(file: Blob, max = 1600, quality = 0.8): Promise<Blob> {
  const img = await load(file);
  try {
    if (!img.width || !img.height) throw new Error("empty image");
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    // White under transparent PNGs so the JPEG is not black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.source, 0, 0, w, h);
    for (const q of [quality, 0.65, 0.5]) {
      const blob = await toBlob(canvas, q);
      if (blob && blob.size <= MAX_PHOTO_BYTES) return blob;
    }
    throw new Error("too large");
  } finally {
    img.close();
  }
}

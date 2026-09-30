type CanvasModule = typeof import("@napi-rs/canvas");

let cached: CanvasModule | null = null;

/**
 * `@napi-rs/canvas` is a native module, so it is loaded lazily (and kept out of
 * the server bundle) — only the image conversion tools ever need it.
 */
function loadCanvas(): CanvasModule {
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("@napi-rs/canvas") as CanvasModule;
  }
  return cached;
}

/** Re-encodes a PNG buffer as JPEG at the requested quality (1-100). */
export async function encodeJpeg(png: Buffer, quality: number): Promise<Buffer> {
  const { createCanvas, loadImage } = loadCanvas();
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return canvas.toBuffer("image/jpeg", quality);
}

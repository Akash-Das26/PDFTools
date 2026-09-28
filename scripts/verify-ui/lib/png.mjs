/* Minimal PNG writer shared by the suites that have to generate an image.
   No encoder is available to the scripts package, so the chunks are written by
   hand — IHDR, one IDAT carrying zlib-deflated scanlines, IEND.

   `mode` picks the pixel data:
     "noise" — real random bytes. Needed whenever a measurement depends on image
               entropy: a cheap PRNG's stream deflates to almost nothing and hides
               the difference between compression profiles entirely.
     "solid" — a flat gradient, which is what a text-free capture should look
               like when the point is that OCR finds nothing in it.
*/
import { deflateSync, crc32 } from "node:zlib";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, checksum]);
}

export function writePng(path, width, height, mode = "noise") {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour

  const rowBytes = width * 3;
  const raw = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + rowBytes);
    raw[rowStart] = 0; // filter: none
    if (mode === "noise") {
      randomBytes(rowBytes).copy(raw, rowStart + 1);
      continue;
    }
    for (let x = 0; x < width; x++) {
      const at = rowStart + 1 + x * 3;
      raw[at] = (x * 3) % 256;
      raw[at + 1] = (y * 3) % 256;
      raw[at + 2] = 120;
    }
  }

  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]));
  return path;
}

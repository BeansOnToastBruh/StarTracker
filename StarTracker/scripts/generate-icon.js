/**
 * Generates build/icon.png for electron-builder (256x256, StarTracker blue badge).
 * Run: node scripts/generate-icon.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 256;
const OUT_DIR = path.join(__dirname, "..", "build");
const OUT_FILE = path.join(OUT_DIR, "icon.png");

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function buildPixels() {
  const row = Buffer.alloc(1 + SIZE * 4);
  const rows = [];
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const radius = SIZE * 0.42;
  const ring = SIZE * 0.06;

  for (let y = 0; y < SIZE; y++) {
    row[0] = 0;
    for (let x = 0; x < SIZE; x++) {
      const o = 1 + x * 4;
      const dist = Math.hypot(x - cx, y - cy);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      if (dist <= radius) {
        const fill = dist <= radius - ring;
        if (fill) {
          r = 90;
          g = 160;
          b = 255;
        } else {
          r = 40;
          g = 120;
          b = 180;
        }
        a = 255;
      }

      row[o] = r;
      row[o + 1] = g;
      row[o + 2] = b;
      row[o + 3] = a;
    }
    rows.push(Buffer.from(row));
  }

  return Buffer.concat(rows);
}

function writePng() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = buildPixels();
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, png);
  console.log(`Wrote ${OUT_FILE}`);
}

writePng();

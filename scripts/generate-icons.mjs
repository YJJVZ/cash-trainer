// Generates the PWA PNG icons (stylized 3×3 grid) with no external dependency.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [11, 18, 32];
const COLORS = [
  [239, 68, 68], [239, 68, 68], [59, 130, 246],
  [239, 68, 68], [59, 130, 246], [71, 85, 105],
  [59, 130, 246], [71, 85, 105], [71, 85, 105],
];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const pad = size * 0.16, gap = size * 0.03;
  const cell = (size - 2 * pad - 2 * gap) / 3;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let color = BG;
      const cx = Math.floor((x - pad) / (cell + gap));
      const cy = Math.floor((y - pad) / (cell + gap));
      if (cx >= 0 && cx < 3 && cy >= 0 && cy < 3) {
        const ox = x - pad - cx * (cell + gap), oy = y - pad - cy * (cell + gap);
        if (ox < cell && oy < cell) color = COLORS[cy * 3 + cx];
      }
      raw.set(color, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/pwa-192.png', png(192));
writeFileSync('public/pwa-512.png', png(512));
writeFileSync('public/apple-touch-icon.png', png(180));
console.log('Icons generated.');

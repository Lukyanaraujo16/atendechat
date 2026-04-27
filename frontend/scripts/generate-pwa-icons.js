/**
 * Gera ícones PNG sólidos (cor de tema) e favicon.ico para PWA.
 * Executar após clonar: node scripts/generate-pwa-icons.js
 * Requer: npm (para png-to-ico via npx).
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { execSync } = require("child_process");

function crc32(buf) {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function solidPng(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const pub = path.join(__dirname, "..", "public");
const brand = { r: 0x15, g: 0x65, b: 0xc0 };

fs.writeFileSync(
  path.join(pub, "android-chrome-192x192.png"),
  solidPng(192, 192, brand.r, brand.g, brand.b)
);
fs.writeFileSync(
  path.join(pub, "android-chrome-512x512.png"),
  solidPng(512, 512, brand.r, brand.g, brand.b)
);
fs.writeFileSync(
  path.join(pub, "icon-maskable-512x512.png"),
  solidPng(512, 512, brand.r, brand.g, brand.b)
);

const png192 = path.join(pub, "android-chrome-192x192.png");
const icoOut = path.join(pub, "favicon.ico");
try {
  const ico = execSync(`npx --yes png-to-ico "${png192}"`, {
    encoding: "buffer",
    maxBuffer: 10 * 1024 * 1024,
  });
  fs.writeFileSync(icoOut, ico);
} catch (e) {
  console.warn(
    "[generate-pwa-icons] png-to-ico falhou; gere favicon.ico manualmente.",
    e.message
  );
}
console.log("[generate-pwa-icons] OK → public/*.png (+ favicon.ico se png-to-ico OK)");

/**
 * Roda fora do Jest: o runtime do Jest não carrega o addon nativo do sharp.
 * Imprime um JSON com evidência objetiva de páginas/ANIM.
 */
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { esModuleInterop: true, module: "commonjs" }
});

const sharp = require("sharp");
const {
  countWebpPages,
  isAnimatedWebpBuffer,
  processStickerToWebp,
  STICKER_OUTPUT_MAX_BYTES
} = require("../stickerImageProcessing.ts");

async function makePng(width, height, color) {
  return sharp({
    create: { width, height, channels: 4, background: color }
  })
    .png()
    .toBuffer();
}

async function makeJpeg(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 12, g: 34, b: 56 }
    }
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function makeStaticWebp(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 20, g: 40, b: 60, alpha: 1 }
    }
  })
    .webp({ quality: 80 })
    .toBuffer();
}

async function makeAnimatedWebp(width, height, frames) {
  const colors = [
    { r: 255, g: 0, b: 0, alpha: 1 },
    { r: 0, g: 255, b: 0, alpha: 1 },
    { r: 0, g: 0, b: 255, alpha: 1 }
  ];
  const inputs = [];
  for (let i = 0; i < frames; i += 1) {
    inputs.push(await makePng(width, height, colors[i % colors.length]));
  }
  return sharp(inputs, { join: { animated: true } })
    .webp({ quality: 80, loop: 0, delay: 80 })
    .toBuffer();
}

async function main() {
  const staticIn = await makeStaticWebp(48, 48);
  const staticOut = await processStickerToWebp(staticIn, "image/webp");

  const animIn = await makeAnimatedWebp(48, 48, 3);
  const animOut = await processStickerToWebp(animIn, "image/webp");

  const bigIn = await makeAnimatedWebp(600, 600, 2);
  const bigOut = await processStickerToWebp(bigIn, "image/webp");
  const bigMeta = await sharp(bigOut, { animated: true, pages: -1 }).metadata();

  const pngOut = await processStickerToWebp(
    await makePng(64, 40, { r: 9, g: 8, b: 7, alpha: 1 }),
    "image/png"
  );
  const pngMeta = await sharp(pngOut).metadata();

  const jpegOut = await processStickerToWebp(await makeJpeg(80, 60), "image/jpeg");
  const jpegMeta = await sharp(jpegOut).metadata();

  const largeStaticIn = await makeStaticWebp(640, 480);
  const largeStaticOut = await processStickerToWebp(largeStaticIn, "image/webp");
  const largeStaticMeta = await sharp(largeStaticOut).metadata();

  process.stdout.write(
    JSON.stringify({
      staticPassThrough: staticOut === staticIn || staticOut.equals(staticIn),
      staticAnimated: isAnimatedWebpBuffer(staticOut),
      staticPages: await countWebpPages(staticOut),
      animInputPages: await countWebpPages(animIn),
      animPassThrough: animOut.equals(animIn),
      animOutputAnimated: isAnimatedWebpBuffer(animOut),
      animOutputPages: await countWebpPages(animOut),
      bigInputPages: await countWebpPages(bigIn),
      bigReencoded: !bigOut.equals(bigIn),
      bigOutputAnimated: isAnimatedWebpBuffer(bigOut),
      bigOutputPages: await countWebpPages(bigOut),
      bigOutputWidth: bigMeta.width,
      bigOutputBytesOk: bigOut.length <= STICKER_OUTPUT_MAX_BYTES,
      pngFormat: pngMeta.format,
      pngAnimated: isAnimatedWebpBuffer(pngOut),
      pngPages: await countWebpPages(pngOut),
      jpegFormat: jpegMeta.format,
      jpegAnimated: isAnimatedWebpBuffer(jpegOut),
      jpegPages: await countWebpPages(jpegOut),
      largeStaticReencoded: !largeStaticOut.equals(largeStaticIn),
      largeStaticWidth: largeStaticMeta.width,
      largeStaticHeight: largeStaticMeta.height,
      largeStaticAnimated: isAnimatedWebpBuffer(largeStaticOut),
      largeStaticBytesOk: largeStaticOut.length <= STICKER_OUTPUT_MAX_BYTES
    })
  );
}

main().catch(err => {
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.exit(1);
});

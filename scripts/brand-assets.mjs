// Gera os arquivos de marca a partir do logo original (fundo branco → transparente).
// Uso: node scripts/brand-assets.mjs
import sharp from "sharp";

const SRC = "assets/brand/logo-original.jpeg";

async function unmatte(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  // Tom mais escuro do rosé gold do logo: define opacidade total
  const darkest = 120;
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const min = Math.min(r, g, b);
    let a = (255 - min) / (255 - darkest);
    a = Math.max(0, Math.min(1, a));
    if (a < 0.04) a = 0;
    const un = (c) => (a === 0 ? 0 : Math.max(0, Math.min(255, Math.round((c - 255 * (1 - a)) / a))));
    out[j] = un(r); out[j + 1] = un(g); out[j + 2] = un(b); out[j + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
}

const meta = await sharp(SRC).metadata();
console.log("original", meta.width, meta.height);

const full = await unmatte(SRC);
const fullPng = await full.png().toBuffer();
await sharp(fullPng).trim({ threshold: 1 }).resize({ width: 900 }).png().toFile("public/brand/logo.png");

// Monograma (borboleta + UF): região superior do logo
const s = meta.width / 656;
const mono = await sharp(fullPng)
  .extract({ left: Math.round(150 * s), top: Math.round(135 * s), width: Math.round(300 * s), height: Math.round(230 * s) })
  .png().toBuffer();
const monoTrim = await sharp(mono).trim({ threshold: 1 }).png().toBuffer();
await sharp(monoTrim).resize({ height: 240 }).png().toFile("public/brand/monogram.png");

// Ícones: monograma sobre fundo blush
const BLUSH = { r: 251, g: 238, b: 235, alpha: 1 };
async function icon(size, file) {
  const inner = await sharp(monoTrim).resize({ width: Math.round(size * 0.78), height: Math.round(size * 0.78), fit: "inside" }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BLUSH } })
    .composite([{ input: inner, gravity: "center" }]).png().toFile(file);
}
await icon(512, "src/app/icon.png");
await icon(180, "src/app/apple-icon.png");
await icon(192, "public/brand/icon-192.png");
await icon(512, "public/brand/icon-512.png");

// Imagem de compartilhamento (1200x630)
const ogLogo = await sharp(fullPng).trim({ threshold: 1 }).resize({ height: 470 }).toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: BLUSH } })
  .composite([{ input: ogLogo, gravity: "center" }]).png().toFile("src/app/opengraph-image.png");
console.log("ok");

// Rasterize brand SVGs to white-background PNG tiles for the deck.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const A = path.join(__dirname, 'assets');
const OUT = path.join(A, 'icons');
fs.mkdirSync(OUT, { recursive: true });

// simpleicons slugs rendered in their official brand color
const brands = {
  nextjs: '#000000',
  express: '#000000',
  typescript: '#3178C6',
  tailwindcss: '#06B6D4',
  postgresql: '#4169E1',
  prisma: '#2D3748',
  redis: '#FF4438',
  cloudinary: '#3448C5',
  vercel: '#000000',
  render: '#46E3B7',
  google: '#4285F4',
  gmail: '#EA4335',
  googlegemini: '#8E75B2',
  safepay: '#0DA678', // unused now (official SVG instead), kept for reference
};

const TILE = 300;      // final tile size (white background)
const GLYPH = 200;     // glyph box inside the tile
const DENSITY = 1536;  // rasterize 24x24 viewBox at high density

async function rasterGlyph(svgFile) {
  const buf = fs.readFileSync(path.join(A, svgFile));
  return sharp(buf, { density: DENSITY })
    .resize(GLYPH, GLYPH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
}

async function tileFromColoredGlyph(name, color, svgFile) {
  const glyph = await rasterGlyph(svgFile);
  // Glyphs from simpleicons are solid black shapes; recolor via mask:
  // base = solid color rect, composite glyph with dest-in -> color masked to glyph shape
  const rect = Buffer.from(`<svg width="${GLYPH}" height="${GLYPH}"><rect width="${GLYPH}" height="${GLYPH}" fill="${color}"/></svg>`);
  const colored = await sharp(rect).composite([{ input: glyph, blend: 'dest-in' }]).png().toBuffer();
  await sharp({
    create: { width: TILE, height: TILE, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
  }).composite([{ input: colored, gravity: 'centre' }]).png().toFile(path.join(OUT, `${name}.png`));
  console.log('tile', name);
}

async function tileFromFullColor(svgFile, outName, widthPx) {
  // For SVGs that carry their own colors (Safepay wordmark)
  const buf = fs.readFileSync(path.join(A, svgFile));
  const meta = await sharp(buf, { density: DENSITY * 4 }).png().toBuffer();
  const img = sharp(meta);
  const m = await img.metadata();
  const scale = widthPx / m.width;
  const h = Math.round(m.height * scale);
  const resized = await img.resize(widthPx, h).png().toBuffer();
  const hPad = Math.max(TILE, h + 60);
  await sharp({
    create: { width: widthPx + 60, height: hPad, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
  }).composite([{ input: resized, gravity: 'centre' }]).png().toFile(path.join(OUT, `${outName}.png`));
  console.log('tile', outName, widthPx + 60, 'x', hPad);
}

(async () => {
  for (const [slug, color] of Object.entries(brands)) {
    const f = `${slug}.svg`;
    if (!fs.existsSync(path.join(A, f))) { console.log('MISSING', slug); continue; }
    if (slug === 'safepay') continue; // uses official wordmark below
    await tileFromColoredGlyph(slug, color, f);
  }
  if (fs.existsSync(path.join(A, 'safepay-logo.svg'))) {
    await tileFromFullColor('safepay-logo.svg', 'safepay', 560);
  } else {
    console.log('MISSING safepay-logo.svg');
  }
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });

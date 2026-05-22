// branding/render-halo-ember.mjs — bake the Halo Ember launcher icon.
//
// Renders three SVG sources (full master, adaptive foreground, adaptive
// background) at every Android mipmap density + a 1024 master + a
// founder-eyeball preview sheet. Writes outputs into:
//   apps/mobile/assets/icon.png                                       (full 1024)
//   apps/mobile/android/app/src/main/res/mipmap-{m,h,xh,xxh,xxxh}dpi/
//     ic_launcher.png                                                  (full @ 48/72/96/144/192)
//     ic_launcher_round.png                                            (same source, Android masks)
//     ic_launcher_foreground.png                                       (foreground @ 108/162/216/324/432)
//     ic_launcher_background.png                                       (background @ 108/162/216/324/432)
//   branding/halo-ember-preview.png                                   (sanity-check sheet)
//
// Run from branding/: `node render-halo-ember.mjs`. Does NOT touch
// app.json, the adaptive XML descriptors, or any of the three
// load-bearing Android prebuild customizations.

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const FONT_DIR =
  'C:/Users/admin/AppData/Roaming/Claude/local-agent-mode-sessions/skills-plugin/67fc33f4-e117-4bc2-af0f-248cd7f4a1a9/80fa3363-50f7-40a8-ad94-00636d437498/skills/canvas-design/canvas-fonts';

const RES_BASE = resolve(REPO, 'apps/mobile/android/app/src/main/res');
const ASSETS_DIR = resolve(REPO, 'apps/mobile/assets');

// Android mipmap densities. ic_launcher PNG sizes per
// https://developer.android.com/training/multiscreen/screendensities.
// Adaptive-icon foreground/background are 108dp × density-multiplier.
const DENSITIES = [
  { dir: 'mipmap-mdpi',    legacy:  48, adaptive: 108 },
  { dir: 'mipmap-hdpi',    legacy:  72, adaptive: 162 },
  { dir: 'mipmap-xhdpi',   legacy:  96, adaptive: 216 },
  { dir: 'mipmap-xxhdpi',  legacy: 144, adaptive: 324 },
  { dir: 'mipmap-xxxhdpi', legacy: 192, adaptive: 432 },
];

function svgToPng(svg, width) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'transparent',
    font: {
      fontDirs: [FONT_DIR],
      defaultFontFamily: 'Instrument Serif',
      loadSystemFonts: true,
    },
  });
  return r.render().asPng();
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function safeUnlink(p) {
  if (existsSync(p)) unlinkSync(p);
}

const fullSvg = readFileSync(resolve(HERE, 'halo-ember.svg'), 'utf8');
const fgSvg = readFileSync(resolve(HERE, 'halo-ember-foreground.svg'), 'utf8');
const bgSvg = readFileSync(resolve(HERE, 'halo-ember-background.svg'), 'utf8');

// 1) 1024 masters → apps/mobile/assets/. Drives expo.icon +
//    expo.android.adaptiveIcon (used for iOS prebuild + Play Store
//    metadata when those builds run).
ensureDir(ASSETS_DIR);
const master1024 = svgToPng(fullSvg, 1024);
writeFileSync(resolve(ASSETS_DIR, 'icon.png'), master1024);
console.log('wrote apps/mobile/assets/icon.png (1024×1024)');
const fg1024 = svgToPng(fgSvg, 1024);
writeFileSync(resolve(ASSETS_DIR, 'adaptive-icon-foreground.png'), fg1024);
console.log('wrote apps/mobile/assets/adaptive-icon-foreground.png (1024×1024)');
const bg1024 = svgToPng(bgSvg, 1024);
writeFileSync(resolve(ASSETS_DIR, 'adaptive-icon-background.png'), bg1024);
console.log('wrote apps/mobile/assets/adaptive-icon-background.png (1024×1024)');

// 2) Legacy + adaptive PNGs per density. Also delete the corresponding
//    .webp placeholders from the Expo template (keeping both with the
//    same root name in one density folder is brittle).
for (const d of DENSITIES) {
  const densityDir = resolve(RES_BASE, d.dir);
  ensureDir(densityDir);

  // Legacy launcher icon — the full composition tile.
  const legacyPng = svgToPng(fullSvg, d.legacy);
  writeFileSync(resolve(densityDir, 'ic_launcher.png'), legacyPng);
  writeFileSync(resolve(densityDir, 'ic_launcher_round.png'), legacyPng);
  safeUnlink(resolve(densityDir, 'ic_launcher.webp'));
  safeUnlink(resolve(densityDir, 'ic_launcher_round.webp'));

  // Adaptive layers — foreground + background.
  const fgPng = svgToPng(fgSvg, d.adaptive);
  writeFileSync(resolve(densityDir, 'ic_launcher_foreground.png'), fgPng);
  const bgPng = svgToPng(bgSvg, d.adaptive);
  writeFileSync(resolve(densityDir, 'ic_launcher_background.png'), bgPng);

  console.log(
    `wrote ${d.dir}: ic_launcher.png ${d.legacy}px · adaptive layers ${d.adaptive}px`,
  );
}

// 3) Eyeball preview sheet — masters at 1024 / 256 / 192 / 96 / 48
//    + a circular-mask preview at 256 (simulates Android adaptive
//    circle mask). Mirrors the existing finalists.png layout.
const PADDING = 48;
const HEADER = 96;
const SLOTS = [
  { label: '1024 master',  size: 256, src: 'master-1024' },
  { label: '256',          size: 200, src: 'master-256'  },
  { label: '192 (xxxhdpi)',size: 192, src: 'master-192' },
  { label: '96 (xhdpi)',   size: 96,  src: 'master-96'  },
  { label: '48 (mdpi)',    size: 48,  src: 'master-48'  },
  { label: 'circular mask',size: 200, src: 'master-256', mask: true },
  { label: 'adaptive fg',  size: 200, src: 'fg-432',     transparent: true },
  { label: 'adaptive bg',  size: 200, src: 'bg-432' },
];

const renders = {
  'master-1024': master1024,
  'master-256':  svgToPng(fullSvg, 256),
  'master-192':  svgToPng(fullSvg, 192),
  'master-96':   svgToPng(fullSvg, 96),
  'master-48':   svgToPng(fullSvg, 48),
  'fg-432':      svgToPng(fgSvg, 432),
  'bg-432':      svgToPng(bgSvg, 432),
};

const COLS = 4;
const ROWS = Math.ceil(SLOTS.length / COLS);
const CELL_W = 280;
const CELL_H = 280;
const sheetW = PADDING * 2 + COLS * CELL_W;
const sheetH = HEADER + PADDING + ROWS * CELL_H + PADDING;

const cells = SLOTS.map((slot, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = PADDING + col * CELL_W;
  const y = HEADER + PADDING + row * CELL_H;
  const cx = x + CELL_W / 2;
  const imgX = cx - slot.size / 2;
  const imgY = y + 20;
  const b64 = renders[slot.src].toString('base64');
  const maskWrap = slot.mask
    ? `<defs><clipPath id="m${i}"><circle cx="${cx}" cy="${imgY + slot.size / 2}" r="${slot.size / 2}"/></clipPath></defs>`
    : '';
  const clipAttr = slot.mask ? ` clip-path="url(#m${i})"` : '';
  const bgRect = slot.transparent
    ? `<rect x="${imgX}" y="${imgY}" width="${slot.size}" height="${slot.size}" fill="#15110D" stroke="#857F7A" stroke-opacity="0.3"/>`
    : '';
  return `
  ${maskWrap}
  ${bgRect}
  <image${clipAttr} x="${imgX}" y="${imgY}" width="${slot.size}" height="${slot.size}" xlink:href="data:image/png;base64,${b64}"/>
  <text x="${cx}" y="${imgY + slot.size + 28}" font-family="Instrument Sans, sans-serif" font-size="14" fill="#B8B2AA" text-anchor="middle">${slot.label}</text>`;
}).join('\n');

const sheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${sheetW} ${sheetH}" width="${sheetW}" height="${sheetH}">
  <rect width="${sheetW}" height="${sheetH}" fill="#15110D"/>
  <text x="${PADDING}" y="56" font-family="Instrument Serif, serif" font-size="36" fill="#E8A063">Leiko · Halo Ember — bake preview</text>
  <text x="${PADDING}" y="82" font-family="Instrument Sans, sans-serif" font-size="14" fill="#B8B2AA">Eyeball before APK build · founder-pick: Halo Ember (Treatment C from Constellation 3D)</text>
  ${cells}
  <text x="${sheetW - PADDING}" y="${sheetH - 16}" font-family="Instrument Sans, sans-serif" font-size="12" fill="#857F7A" text-anchor="end">${new Date().toISOString().slice(0, 10)} · branding/render-halo-ember.mjs</text>
</svg>`;

writeFileSync(resolve(HERE, 'halo-ember-preview.svg'), sheetSvg);
const previewPng = svgToPng(sheetSvg, sheetW);
writeFileSync(resolve(HERE, 'halo-ember-preview.png'), previewPng);
console.log(`wrote branding/halo-ember-preview.png (${sheetW}×${sheetH})`);

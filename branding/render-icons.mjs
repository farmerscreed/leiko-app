// branding/render-icons.mjs — render the two finalist icon concepts
// at full size, at Android launcher thumbnail sizes (48/72/96/144/192),
// and inside a circular mask preview (so we can see how it survives
// Android adaptive-icon shape clipping).
//
// Run from branding/: `node render-icons.mjs`

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FONT_DIR =
  'C:/Users/admin/AppData/Roaming/Claude/local-agent-mode-sessions/skills-plugin/67fc33f4-e117-4bc2-af0f-248cd7f4a1a9/80fa3363-50f7-40a8-ad94-00636d437498/skills/canvas-design/canvas-fonts';

const CONCEPTS = [
  { file: '01-two-figures-icon.svg', label: '1.  Two figures forming a heart' },
  { file: '04-sankofa-icon.svg',     label: '4.  Sankofa heart' },
];

function svgToPng(svg, width) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'transparent',
    font: {
      fontDirs: [FONT_DIR],
      defaultFontFamily: 'Instrument Serif',
      loadSystemFonts: false,
    },
  });
  return r.render().asPng();
}

// 1) Render each at 1024 + the five Android launcher mipmap sizes
//    + a 256 mid-size for the comparison sheet.
const ANDROID_SIZES = [48, 72, 96, 144, 192];
for (const c of CONCEPTS) {
  const svg = readFileSync(resolve(HERE, 'concepts', c.file), 'utf8');
  for (const w of [1024, 256, ...ANDROID_SIZES]) {
    const png = svgToPng(svg, w);
    const out = resolve(HERE, 'concepts', c.file.replace(/\.svg$/, `-${w}.png`));
    writeFileSync(out, png);
  }
  console.log(`rendered ${c.file} at ${ANDROID_SIZES.length + 2} sizes`);
}

// 2) Build the comparison sheet. Three columns per concept: full
//    1024 (boxed square Android), 256 (boxed square), 96 (a typical
//    home-screen render size), 48 (mdpi — worst case). Plus a
//    circular-mask preview at 256 to show how Android's adaptive-icon
//    masking would clip it.
const COLS = 6; // [label] [1024] [256] [96] [48] [256-circle]
const ROWS = CONCEPTS.length;
const PADDING = 64;
const HDR_H = 120;
const FOOTER_H = 80;
const ROW_H = 320;
const COL_LABEL_W = 280;
const COL_FULL_W = 280;
const COL_256_W = 240;
const COL_96_W = 120;
const COL_48_W = 80;
const COL_CIRCLE_W = 240;
const GUTTER = 24;

const sheetW =
  PADDING * 2 +
  COL_LABEL_W +
  GUTTER +
  COL_FULL_W +
  GUTTER +
  COL_256_W +
  GUTTER +
  COL_96_W +
  GUTTER +
  COL_48_W +
  GUTTER +
  COL_CIRCLE_W;
const sheetH = HDR_H + ROWS * ROW_H + FOOTER_H + PADDING * 2;

function b64(file) {
  return readFileSync(resolve(HERE, 'concepts', file)).toString('base64');
}

const tiles = CONCEPTS.map((c, idx) => {
  const y = HDR_H + PADDING + idx * ROW_H;
  const base = c.file.replace(/\.svg$/, '');
  return {
    y,
    label: c.label,
    p1024: b64(`${base}-1024.png`),
    p256: b64(`${base}-256.png`),
    p96: b64(`${base}-96.png`),
    p48: b64(`${base}-48.png`),
  };
});

const xLabel = PADDING;
const xFull = xLabel + COL_LABEL_W + GUTTER;
const x256 = xFull + COL_FULL_W + GUTTER;
const x96 = x256 + COL_256_W + GUTTER;
const x48 = x96 + COL_96_W + GUTTER;
const xCircle = x48 + COL_48_W + GUTTER;

// Column headers
const headers = `
  <text x="${xLabel + 10}" y="${HDR_H - 10}" font-family="Instrument Sans" font-size="16" fill="#857F7A" letter-spacing="0.6" text-anchor="start">Concept</text>
  <text x="${xFull + COL_FULL_W / 2}" y="${HDR_H - 10}" font-family="Instrument Sans" font-size="16" fill="#857F7A" letter-spacing="0.6" text-anchor="middle">Store icon  ·  1024</text>
  <text x="${x256 + COL_256_W / 2}" y="${HDR_H - 10}" font-family="Instrument Sans" font-size="16" fill="#857F7A" letter-spacing="0.6" text-anchor="middle">256</text>
  <text x="${x96 + COL_96_W / 2}" y="${HDR_H - 10}" font-family="Instrument Sans" font-size="16" fill="#857F7A" letter-spacing="0.6" text-anchor="middle">96  (xhdpi)</text>
  <text x="${x48 + COL_48_W / 2}" y="${HDR_H - 10}" font-family="Instrument Sans" font-size="16" fill="#857F7A" letter-spacing="0.6" text-anchor="middle">48  (mdpi)</text>
  <text x="${xCircle + COL_CIRCLE_W / 2}" y="${HDR_H - 10}" font-family="Instrument Sans" font-size="16" fill="#857F7A" letter-spacing="0.6" text-anchor="middle">Circular mask</text>
`;

const sheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${sheetW} ${sheetH}" width="${sheetW}" height="${sheetH}">
  <rect width="${sheetW}" height="${sheetH}" fill="#15110D"/>

  <text x="${PADDING}" y="60" font-family="Instrument Serif" font-size="42" fill="#E8A063">Leiko — finalists, icon-tuned</text>
  <text x="${PADDING}" y="92" font-family="Instrument Sans" font-size="16" fill="#B8B2AA">Each row: full 1024 master · 256 · 96 (xhdpi typical) · 48 (mdpi worst-case) · circular mask preview</text>

  ${headers}

  <defs>
    <clipPath id="circleMask">
      <circle cx="${COL_CIRCLE_W / 2}" cy="${COL_CIRCLE_W / 2}" r="${COL_CIRCLE_W / 2}"/>
    </clipPath>
  </defs>

  ${tiles
    .map(
      (t) => `
  <text x="${xLabel}" y="${t.y + 28}" font-family="Instrument Serif" font-size="28" fill="#F5E6D3">${t.label}</text>

  <image x="${xFull}" y="${t.y + 8}" width="${COL_FULL_W}" height="${COL_FULL_W}" xlink:href="data:image/png;base64,${t.p1024}"/>
  <image x="${x256}" y="${t.y + 8}" width="${COL_256_W}" height="${COL_256_W}" xlink:href="data:image/png;base64,${t.p256}"/>
  <image x="${x96}" y="${t.y + 8 + 80}" width="${COL_96_W}" height="${COL_96_W}" xlink:href="data:image/png;base64,${t.p96}"/>
  <image x="${x48}" y="${t.y + 8 + 100}" width="${COL_48_W}" height="${COL_48_W}" xlink:href="data:image/png;base64,${t.p48}"/>

  <g transform="translate(${xCircle}, ${t.y + 8})" clip-path="url(#circleMask)">
    <image x="0" y="0" width="${COL_CIRCLE_W}" height="${COL_CIRCLE_W}" xlink:href="data:image/png;base64,${t.p256}"/>
  </g>
  `
    )
    .join('\n')}

  <text x="${sheetW - PADDING}" y="${sheetH - 32}" font-family="Instrument Sans" font-size="14" fill="#857F7A" text-anchor="end">Leiko · 2026-05-22 · finalist comparison</text>
</svg>`;

writeFileSync(resolve(HERE, 'finalists.svg'), sheetSvg);
const sheetPng = svgToPng(sheetSvg, 2400);
writeFileSync(resolve(HERE, 'finalists.png'), sheetPng);
console.log(`composed ${resolve(HERE, 'finalists.png')}`);

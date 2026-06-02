// branding/render.mjs — render 5 concept SVGs to 1024x1024 PNGs +
// assemble a labelled comparison sheet for review.
//
// Run from branding/: `node render.mjs`

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FONT_DIR =
  'C:/Users/admin/AppData/Roaming/Claude/local-agent-mode-sessions/skills-plugin/67fc33f4-e117-4bc2-af0f-248cd7f4a1a9/80fa3363-50f7-40a8-ad94-00636d437498/skills/canvas-design/canvas-fonts';

const CONCEPTS = [
  { file: '01-two-figures.svg',  label: '1.  Two figures forming a heart' },
  { file: '02-cupped-hands.svg', label: '2.  Heart cradled in cupped hands' },
  { file: '03-soft-pulse.svg',   label: '3.  Soft pulse heart' },
  { file: '04-sankofa.svg',      label: '4.  Sankofa heart' },
  { file: '05-watch-heart.svg',  label: '5.  Watch + heart' },
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

// 1) Render each concept at full 1024 res.
for (const c of CONCEPTS) {
  const svg = readFileSync(resolve(HERE, 'concepts', c.file), 'utf8');
  const png = svgToPng(svg, 1024);
  const out = resolve(HERE, 'concepts', c.file.replace(/\.svg$/, '-1024.png'));
  writeFileSync(out, png);
  console.log(`rendered ${out}  (${(png.length / 1024).toFixed(1)} KB)`);
}

// 2) Build the comparison sheet — a single SVG that embeds each rendered
// concept as a tile. 3-up wide layout: a 3x2 grid where the 6th cell
// holds a brief legend.
const TILE = 480;                // size of each concept tile in the sheet
const PADDING = 64;              // outer padding
const GUTTER = 56;               // gap between tiles
const LABEL_H = 56;              // height reserved under each tile for label
const COLS = 3;
const ROWS = 2;

const sheetW = PADDING * 2 + TILE * COLS + GUTTER * (COLS - 1);
const sheetH = PADDING * 2 + (TILE + LABEL_H) * ROWS + GUTTER * (ROWS - 1) + 80; // +80 for header

// Compose tiles as inline base64 PNGs so resvg can paint them.
const tiles = CONCEPTS.map((c, idx) => {
  const png = readFileSync(
    resolve(HERE, 'concepts', c.file.replace(/\.svg$/, '-1024.png'))
  );
  const b64 = png.toString('base64');
  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  const x = PADDING + col * (TILE + GUTTER);
  const y = 80 + PADDING + row * (TILE + LABEL_H + GUTTER);
  return { x, y, b64, label: c.label };
});

const sheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${sheetW} ${sheetH}" width="${sheetW}" height="${sheetH}">
  <rect width="${sheetW}" height="${sheetH}" fill="#15110D"/>

  <!-- Header -->
  <text x="${PADDING}" y="86" font-family="Instrument Serif" font-size="44" fill="#E8A063" letter-spacing="0.5">Leiko — five logo directions</text>
  <text x="${PADDING}" y="124" font-family="Instrument Sans" font-size="18" fill="#B8B2AA" letter-spacing="0.4">Hearth Tender · concept comparison · pick a winner, refine from there</text>

  ${tiles
    .map(
      (t) => `
  <g>
    <image x="${t.x}" y="${t.y}" width="${TILE}" height="${TILE}" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/png;base64,${t.b64}"/>
    <text x="${t.x}" y="${t.y + TILE + 32}" font-family="Instrument Sans" font-size="20" fill="#F5E6D3">${t.label}</text>
  </g>`
    )
    .join('\n')}

  <!-- Sixth cell: a small palette / note panel. -->
  <g>
    <rect x="${PADDING + 2 * (TILE + GUTTER)}" y="${80 + PADDING + (TILE + LABEL_H + GUTTER)}" width="${TILE}" height="${TILE}" rx="20" ry="20" fill="#1F1A14"/>
    <text x="${PADDING + 2 * (TILE + GUTTER) + 36}" y="${80 + PADDING + (TILE + LABEL_H + GUTTER) + 64}" font-family="Instrument Serif" font-size="32" fill="#E8A063">palette</text>

    <!-- Three swatches -->
    <rect x="${PADDING + 2 * (TILE + GUTTER) + 36}"  y="${80 + PADDING + (TILE + LABEL_H + GUTTER) + 96}" width="${(TILE - 72) / 3 - 12}" height="80" fill="#E8A063" rx="10"/>
    <rect x="${PADDING + 2 * (TILE + GUTTER) + 36 + (TILE - 72) / 3}" y="${80 + PADDING + (TILE + LABEL_H + GUTTER) + 96}" width="${(TILE - 72) / 3 - 12}" height="80" fill="#A86436" rx="10"/>
    <rect x="${PADDING + 2 * (TILE + GUTTER) + 36 + 2 * (TILE - 72) / 3}" y="${80 + PADDING + (TILE + LABEL_H + GUTTER) + 96}" width="${(TILE - 72) / 3 - 12}" height="80" fill="#1F1A14" stroke="#3A2F25" stroke-width="2" rx="10"/>

    <text x="${PADDING + 2 * (TILE + GUTTER) + 36}"  y="${80 + PADDING + (TILE + LABEL_H + GUTTER) + 200}" font-family="Instrument Sans" font-size="14" fill="#B8B2AA">#E8A063</text>
    <text x="${PADDING + 2 * (TILE + GUTTER) + 36 + (TILE - 72) / 3}" y="${80 + PADDING + (TILE + LABEL_H + GUTTER) + 200}" font-family="Instrument Sans" font-size="14" fill="#B8B2AA">#A86436</text>
    <text x="${PADDING + 2 * (TILE + GUTTER) + 36 + 2 * (TILE - 72) / 3}" y="${80 + PADDING + (TILE + LABEL_H + GUTTER) + 200}" font-family="Instrument Sans" font-size="14" fill="#B8B2AA">#1F1A14</text>

    <text x="${PADDING + 2 * (TILE + GUTTER) + 36}" y="${80 + PADDING + (TILE + LABEL_H + GUTTER) + 268}" font-family="Instrument Sans" font-size="16" fill="#F5E6D3">No red.  No clinical.</text>
    <text x="${PADDING + 2 * (TILE + GUTTER) + 36}" y="${80 + PADDING + (TILE + LABEL_H + GUTTER) + 294}" font-family="Instrument Sans" font-size="16" fill="#F5E6D3">Warm matte.  No gloss.</text>
    <text x="${PADDING + 2 * (TILE + GUTTER) + 36}" y="${80 + PADDING + (TILE + LABEL_H + GUTTER) + 320}" font-family="Instrument Sans" font-size="16" fill="#F5E6D3">Centred.  Held, not floating.</text>
  </g>

  <!-- Footer -->
  <text x="${sheetW - PADDING}" y="${sheetH - 32}" font-family="Instrument Sans" font-size="14" fill="#857F7A" text-anchor="end">leiko — v1.0  ·  2026-05-21  ·  five candidates</text>
</svg>`;

writeFileSync(resolve(HERE, 'concepts.svg'), sheetSvg);
const sheetPng = svgToPng(sheetSvg, 2400);
writeFileSync(resolve(HERE, 'concepts.png'), sheetPng);
console.log(`composed ${resolve(HERE, 'concepts.png')}  (${(sheetPng.length / 1024).toFixed(1)} KB)`);

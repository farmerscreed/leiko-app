#!/usr/bin/env node
// Convert leiko-ads-playbook.md → styled HTML for PDF print.
// Uses marked CLI as a subprocess (marked v18 is ESM-only).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const src = path.resolve(__dirname, '../docs/marketing/leiko-ads-playbook.md');
const dst = path.resolve(__dirname, '../docs/marketing/leiko-ads-playbook.html');

const body = execFileSync(
  'node',
  ['/tmp/node_modules/marked/bin/marked.js', '--gfm', '-i', src],
  { encoding: 'utf8' },
);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Leiko Ads Playbook</title>
<style>
  @page { margin: 22mm 18mm; }
  body {
    font-family: 'Georgia', 'Charter', 'Times New Roman', serif;
    color: #1a1410;
    line-height: 1.55;
    max-width: 760px;
    margin: 0 auto;
    padding: 36px 28px;
    background: #fafaf7;
    font-size: 11pt;
  }
  h1 {
    font-family: 'Helvetica Neue', 'Inter', sans-serif;
    font-size: 26pt;
    letter-spacing: -0.4px;
    color: #1a1410;
    margin: 28px 0 10px 0;
    border-bottom: 2px solid #c96442;
    padding-bottom: 8px;
  }
  h1:first-of-type { page-break-before: avoid; }
  h2 {
    font-family: 'Helvetica Neue', 'Inter', sans-serif;
    font-size: 17pt;
    letter-spacing: -0.2px;
    color: #1a1410;
    margin: 28px 0 8px 0;
    border-bottom: 1px solid #c8b9a8;
    padding-bottom: 4px;
    page-break-after: avoid;
  }
  h3 {
    font-family: 'Helvetica Neue', 'Inter', sans-serif;
    font-size: 13pt;
    color: #3d342b;
    margin: 22px 0 6px 0;
    page-break-after: avoid;
  }
  h4 {
    font-family: 'Helvetica Neue', 'Inter', sans-serif;
    font-size: 11pt;
    color: #3d342b;
    margin: 16px 0 4px 0;
    page-break-after: avoid;
  }
  p { margin: 10px 0; }
  ul, ol { margin: 8px 0 12px 22px; padding: 0; }
  li { margin: 4px 0; }
  code {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    background: #f1ece2;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 9.5pt;
    color: #1a1410;
  }
  pre {
    background: #f1ece2;
    padding: 12px 14px;
    border-left: 3px solid #c96442;
    border-radius: 3px;
    overflow-x: auto;
    font-size: 9.5pt;
    line-height: 1.4;
    page-break-inside: avoid;
  }
  pre code { background: none; padding: 0; }
  blockquote {
    border-left: 3px solid #c8b9a8;
    margin: 12px 0;
    padding: 4px 14px;
    color: #3d342b;
    font-style: italic;
  }
  table {
    border-collapse: collapse;
    margin: 14px 0;
    width: 100%;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #c8b9a8;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #1a1410;
    color: #fafaf7;
    font-family: 'Helvetica Neue', 'Inter', sans-serif;
    font-size: 9.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  tr:nth-child(even) td { background: #f5f1e8; }
  hr {
    border: none;
    border-top: 1px solid #c8b9a8;
    margin: 28px 0;
  }
  a { color: #c96442; text-decoration: none; border-bottom: 1px solid #e8d8c5; }
  strong { color: #1a1410; }
  em { color: #3d342b; }
  @media print {
    body { background: white; padding: 0; }
    pre, table, blockquote { page-break-inside: avoid; }
  }
  @media screen and (max-width: 720px) {
    body { padding: 16px; font-size: 14px; }
    h1 { font-size: 24px; }
    h2 { font-size: 19px; }
    pre, table { font-size: 12px; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;

fs.writeFileSync(dst, html);
console.log(`Wrote ${dst} (${html.length} bytes)`);

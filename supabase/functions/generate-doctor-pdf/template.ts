// HTML template builder for the doctor-ready PDF.
// Sprint 9 (core) · Sprint 19 Block 10 (visual polish + SVG charts).
//
// Produces the seven-section layout per D13 §10.2 + voice rules per
// docs/05-voice-and-claims.md. Styles are inlined as a single <style>
// block so the rasterizer doesn't have to fetch external assets.
//
// Block 10 changes from Sprint 9 baseline:
//   - Branded Halo Ember letterhead on the cover (inline SVG)
//   - Per-vital colour accents on h2 headers (coral / amber / gold /
//     indigo / sage)
//   - Inline SVG charts for every vital (twin-line BP, line HR, line
//     SpO2 with 90% baseline, stacked sleep bars, activity bars vs
//     target)
//   - BP distribution flipped from a table to a horizontal stacked
//     bar with a legend (table-style detail rows preserved for
//     readability)
//   - Print-safe page breaks: cover → BP → HR → SpO2 → Sleep →
//     Activity → Cross-vital → Notes, each on its own page when
//     dense, run together when sparse
//   - Footer eyebrow on every section with "Leiko · [name] · [date]"
//
// Voice gate — every user-visible string in this file passes:
//   • No "patient", "diagnose", "treat", "predict", "dangerous",
//     "critical", "silent killer", "medical advice".
//   • Cover line per account_type:
//     - caregiver: "This report is general information from {parent}'s
//       Leiko watch. It is not a diagnosis. Please discuss with their
//       doctor."
//     - self_buyer: "This report is general information from your
//       Leiko watch. It is not a diagnosis. Please discuss with your doctor."

import {
  renderActivityBars,
  renderBpDistributionBar,
  renderBpTrendChart,
  renderHrTrendChart,
  renderSleepStackedBars,
  renderSpO2TrendChart,
} from './charts.ts';
import type { AccountType, ReportData } from './types.ts';

export interface TemplateOptions {
  /** Render mode: html (default) or html-fragment (no doctype/html
   *  wrapper, useful for tests). Defaults to 'html'. */
  fragment?: boolean;
}

export function renderReport(
  data: ReportData,
  options: TemplateOptions = {},
): string {
  const footer = renderFooter(data);
  const body = `
${section('cover', renderCover(data))}
${section('bp', renderBP(data) + footer)}
${section('hr', renderHR(data) + footer)}
${section('spo2', renderSpO2(data) + footer)}
${section('sleep', renderSleep(data) + footer)}
${section('activity', renderActivity(data) + footer)}
${section('cross-vital', renderCrossVital(data) + footer)}
${section('notes', renderNotes(data) + footer)}
`.trim();

  if (options.fragment) return body;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(reportTitle(data))}</title>
    <style>${STYLES}</style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function section(id: string, contents: string): string {
  return `<section id="report-${id}" class="report-${id}">${contents}</section>`;
}

function reportTitle(data: ReportData): string {
  return `Leiko report · ${data.user.displayName} · ${data.rangeLabel}`;
}

function renderFooter(data: ReportData): string {
  return `<p class="page-footer">Leiko · ${escape(data.user.displayName)} · ${escape(formatDate(data.generatedAtIso))}</p>`;
}

// ── Cover ───────────────────────────────────────────────────────────

/** Inline Halo Ember mark — compact 56pt circular badge for the
 *  letterhead. sRGB approximations of the source oklch palette
 *  (matches branding/halo-ember.svg). */
function haloEmberMark(size = 56): string {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <defs>
      <radialGradient id="he-bg" cx="50%" cy="100%" r="100%">
        <stop offset="0%" stop-color="#C96442"/>
        <stop offset="25%" stop-color="#E8A063" stop-opacity="0.55"/>
        <stop offset="65%" stop-color="#1A1614"/>
        <stop offset="100%" stop-color="#0A0907"/>
      </radialGradient>
      <linearGradient id="he-arc" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FBEBD6"/>
        <stop offset="40%" stop-color="#F5B98C"/>
        <stop offset="100%" stop-color="#B8523A"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="46" fill="url(#he-bg)"/>
    <g transform="rotate(-115 50 50)">
      <circle cx="50" cy="50" r="36" fill="none" stroke="url(#he-arc)" stroke-width="3" stroke-linecap="round" stroke-dasharray="180 226"/>
    </g>
    <text x="32" y="62" font-family="'Instrument Serif', Georgia, serif" font-size="32" font-style="italic" fill="#FBF8F3" letter-spacing="-1">L</text>
    <circle cx="56" cy="58" r="4.5" fill="#F5B98C"/>
    <circle cx="55" cy="57" r="1.6" fill="#FBE6CC"/>
  </svg>
  `;
}

function coverLine(accountType: AccountType, displayName: string): string {
  if (accountType === 'caregiver') {
    return `This report is general information from ${displayName}'s Leiko watch. It is not a diagnosis. Please discuss with their doctor.`;
  }
  return `This report is general information from your Leiko watch. It is not a diagnosis. Please discuss with your doctor.`;
}

function renderCover(data: ReportData): string {
  const ageLine = data.user.yearOfBirth
    ? `${new Date().getUTCFullYear() - data.user.yearOfBirth} years old`
    : '';
  const aiCover = data.aiSections?.cover
    ? `<p class="cover-ai">${escape(data.aiSections.cover)}</p>`
    : '';
  const note =
    data.coverNote && data.coverNote.trim().length > 0
      ? `<div class="cover-note"><p class="cover-note-eyebrow">From ${escape(data.user.displayName)}</p><p class="cover-note-body">${escape(data.coverNote.trim())}</p></div>`
      : '';
  return `
    <header class="cover">
      <div class="cover-mark">${haloEmberMark(72)}</div>
      <p class="brand-eyebrow">Leiko · Pulse report</p>
      <h1 class="cover-headline">${escape(data.user.displayName)}</h1>
      <p class="cover-meta">${escape(data.rangeLabel)}${ageLine ? ' · ' + escape(ageLine) : ''}</p>
      ${aiCover}
      ${note}
      <p class="cover-line">${escape(coverLine(data.user.accountType, data.user.displayName))}</p>
      <p class="generated-at">Generated ${escape(formatDate(data.generatedAtIso))}</p>
    </header>
  `;
}

// ── Vital sections ──────────────────────────────────────────────────

function renderSectionHeader(label: string, vital: string): string {
  return `<div class="section-head section-head-${vital}"><span class="section-accent"></span><h2>${label}</h2></div>`;
}

function renderBP(data: ReportData): string {
  const { avgSys, avgDia, pctInRange, distribution, topAbnormal, count, points } = data.bp;
  if (count === 0) {
    return `
      ${renderSectionHeader('Blood pressure', 'bp')}
      <p class="muted">No blood-pressure readings in this range.</p>
    `;
  }
  const chart = renderBpTrendChart(points);
  const summary = `
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average</span><span class="stat-value">${formatBP(avgSys, avgDia)} <span class="unit">mmHg</span></span></div>
      <div class="stat"><span class="stat-label">In range</span><span class="stat-value">${formatPct(pctInRange)}</span></div>
      <div class="stat"><span class="stat-label">Readings</span><span class="stat-value">${count}</span></div>
    </div>
  `;
  const dist = `
    <h3 class="subheading">Classification distribution</h3>
    ${renderBpDistributionBar(distribution)}
    <table class="dist-table">
      <thead><tr><th>Category</th><th>Count</th></tr></thead>
      <tbody>
        <tr><td>Normal</td><td>${distribution.normal}</td></tr>
        <tr><td>Elevated</td><td>${distribution.elevated}</td></tr>
        <tr><td>Stage 1</td><td>${distribution.stage1}</td></tr>
        <tr><td>Stage 2</td><td>${distribution.stage2}</td></tr>
        <tr><td>Crisis (≥180/120)</td><td>${distribution.crisis}</td></tr>
      </tbody>
    </table>
  `;
  const abnormal =
    topAbnormal.length === 0
      ? '<p class="muted">No readings outside the normal band over the period.</p>'
      : `
    <h3 class="subheading">Most abnormal readings</h3>
    <table class="reading-table">
      <thead><tr><th>Day</th><th>BP</th><th>Pulse</th><th>Category</th></tr></thead>
      <tbody>
        ${topAbnormal
          .map(
            (r) => `
          <tr>
            <td>${escape(r.day)}</td>
            <td>${r.sys}/${r.dia}</td>
            <td>${r.pulse ?? '—'}</td>
            <td>${labelForBPClass(r.classification)}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `;
  return `
    ${renderSectionHeader('Blood pressure', 'bp')}
    ${chart}
    ${summary}
    ${dist}
    ${abnormal}
  `;
}

function renderHR(data: ReportData): string {
  const { avgResting, count, points } = data.hr;
  if (count === 0) {
    return `
      ${renderSectionHeader('Heart rate', 'hr')}
      <p class="muted">No heart-rate samples over the period.</p>
    `;
  }
  return `
    ${renderSectionHeader('Heart rate', 'hr')}
    ${renderHrTrendChart(points)}
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average resting</span><span class="stat-value">${formatBpm(avgResting)} <span class="unit">bpm</span></span></div>
      <div class="stat"><span class="stat-label">Days observed</span><span class="stat-value">${points.length}</span></div>
      <div class="stat"><span class="stat-label">Samples</span><span class="stat-value">${count}</span></div>
    </div>
  `;
}

function renderSpO2(data: ReportData): string {
  const { avgMinPercent, daysBelow90, count, points } = data.spo2;
  if (count === 0) {
    return `
      ${renderSectionHeader('Blood oxygen (SpO2)', 'spo2')}
      <p class="muted">No blood-oxygen samples over the period.</p>
    `;
  }
  return `
    ${renderSectionHeader('Blood oxygen (SpO2)', 'spo2')}
    ${renderSpO2TrendChart(points)}
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average overnight low</span><span class="stat-value">${formatPercent(avgMinPercent)}</span></div>
      <div class="stat"><span class="stat-label">Days below 90%</span><span class="stat-value">${daysBelow90}</span></div>
      <div class="stat"><span class="stat-label">Days observed</span><span class="stat-value">${points.length}</span></div>
    </div>
  `;
}

function renderSleep(data: ReportData): string {
  const { avgTotalMinutes, count, points } = data.sleep;
  if (count === 0) {
    return `
      ${renderSectionHeader('Sleep', 'sleep')}
      <p class="muted">No sleep sessions recorded over the period.</p>
    `;
  }
  return `
    ${renderSectionHeader('Sleep', 'sleep')}
    ${renderSleepStackedBars(points)}
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average total</span><span class="stat-value">${formatHM(avgTotalMinutes)}</span></div>
      <div class="stat"><span class="stat-label">Nights observed</span><span class="stat-value">${points.length}</span></div>
    </div>
  `;
}

function renderActivity(data: ReportData): string {
  const { avgSteps, count, points } = data.activity;
  if (count === 0) {
    return `
      ${renderSectionHeader('Activity', 'activity')}
      <p class="muted">No activity samples over the period.</p>
    `;
  }
  return `
    ${renderSectionHeader('Activity', 'activity')}
    ${renderActivityBars(points)}
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average daily steps</span><span class="stat-value">${formatSteps(avgSteps)}</span></div>
      <div class="stat"><span class="stat-label">Days observed</span><span class="stat-value">${points.length}</span></div>
    </div>
  `;
}

function renderCrossVital(data: ReportData): string {
  const aiObs = data.aiSections?.observations
    ? data.aiSections.observations
        .split(/\n{2,}/)
        .map((p) => `<p class="cross-vital-ai">${escape(p.trim())}</p>`)
        .join('')
    : '';

  if (data.correlations.length === 0) {
    if (aiObs) {
      return `
        ${renderSectionHeader('Cross-vital observations', 'cross')}
        ${aiObs}
      `;
    }
    return `
      ${renderSectionHeader('Cross-vital observations', 'cross')}
      <p class="muted">No cross-vital patterns reached the meaningful threshold over the selected range.</p>
    `;
  }
  const cards = data.correlations
    .map(
      (c) => `
    <div class="correlation-card">
      <p class="correlation-eyebrow">${escape(eyebrowFor(c.correlation_type))}</p>
      <p class="correlation-body">${escape(c.narrative_long ?? '')}</p>
      <p class="correlation-stat">n = ${c.sample_n ?? 0}${c.pearson_r === null ? '' : ` · r = ${c.pearson_r.toFixed(2)}`}</p>
    </div>
  `,
    )
    .join('');
  return `
    ${renderSectionHeader('Cross-vital observations', 'cross')}
    ${aiObs}
    ${cards}
  `;
}

function renderNotes(data: ReportData): string {
  if (data.notes.length === 0) {
    return `
      ${renderSectionHeader('Notes', 'notes')}
      <p class="muted">No notes attached to readings in this range.</p>
    `;
  }
  return `
    ${renderSectionHeader('Notes', 'notes')}
    <ul class="notes-list">
      ${data.notes
        .map(
          (n) =>
            `<li><span class="note-day">${escape(n.day)}</span> ${escape(n.body)}</li>`,
        )
        .join('')}
    </ul>
  `;
}

// ── Helpers ─────────────────────────────────────────────────────────

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatBP(sys: number | null, dia: number | null): string {
  if (sys === null || dia === null) return '—';
  return `${Math.round(sys)}/${Math.round(dia)}`;
}

function formatBpm(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}`;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`;
}

function formatPct(fraction: number | null): string {
  return fraction === null ? '—' : `${Math.round(fraction * 100)}%`;
}

function formatHM(min: number | null): string {
  if (min === null) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatSteps(value: number | null): string {
  if (value === null) return '—';
  return value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : `${Math.round(value)}`;
}

function labelForBPClass(c: string): string {
  switch (c) {
    case 'normal':
      return 'Normal';
    case 'elevated':
      return 'Elevated';
    case 'stage1':
      return 'Stage 1';
    case 'stage2':
      return 'Stage 2';
    case 'crisis':
      return 'Crisis';
    default:
      return c;
  }
}

function eyebrowFor(type: string): string {
  switch (type) {
    case 'sleep_x_morning_bp':
      return 'Sleep · Blood pressure';
    case 'activity_x_resting_hr':
      return 'Activity · Heart rate';
    case 'spo2_dip_x_sleep_score':
      return 'SpO2 · Sleep';
    default:
      return type;
  }
}

// ── Styles ──────────────────────────────────────────────────────────

const STYLES = `
@page { size: Letter; margin: 18mm; }
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif&display=swap');

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11pt;
  line-height: 1.5;
  color: #1a1610;
  background: #fbf8f3;
}

section { padding: 12mm 0 6mm; }
section.report-cover { padding: 24mm 0 14mm; text-align: center; page-break-after: always; }
section.report-bp,
section.report-hr,
section.report-spo2,
section.report-sleep,
section.report-activity,
section.report-cross-vital { page-break-before: always; page-break-inside: avoid; }
section.report-notes { page-break-inside: avoid; }

/* ── Cover ────────────────────────────────────────── */
.cover-mark { margin: 0 auto 8mm; line-height: 0; }
.brand-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 9pt;
  color: #C96442;
  margin: 0 0 6mm;
  font-weight: 500;
}
.cover-headline {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 36pt;
  line-height: 1.05;
  margin: 0 0 4mm;
  font-weight: 400;
  letter-spacing: -0.5pt;
  color: #1a1610;
}
.cover-meta {
  font-size: 12pt;
  color: #4a4339;
  margin: 0 0 8mm;
  font-feature-settings: "tnum";
}
.cover-ai {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 14pt;
  line-height: 1.5;
  color: #2a241c;
  max-width: 140mm;
  margin: 0 auto 6mm;
  text-align: left;
  font-style: italic;
}
.cover-note {
  max-width: 140mm;
  margin: 0 auto 8mm;
  padding: 5mm 6mm;
  background: rgba(232, 160, 99, 0.07);
  border-left: 2pt solid #C96442;
  text-align: left;
  border-radius: 0 3mm 3mm 0;
}
.cover-note-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 8.5pt;
  color: #C96442;
  margin: 0 0 2mm;
  font-weight: 500;
}
.cover-note-body {
  font-size: 11pt;
  line-height: 1.55;
  color: #2a241c;
  margin: 0;
}
.cover-line {
  font-style: italic;
  color: #4a4339;
  max-width: 140mm;
  margin: 8mm auto 12mm;
  font-size: 10pt;
  line-height: 1.5;
}
.generated-at {
  font-size: 9pt;
  color: #8b8378;
  margin: 0;
  font-feature-settings: "tnum";
}

/* ── Section heads with vital-coloured accent ────── */
.section-head {
  display: flex;
  align-items: center;
  gap: 4mm;
  margin: 0 0 4mm;
  padding-bottom: 2mm;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.section-head h2 {
  margin: 0;
  font-size: 16pt;
  font-weight: 600;
  color: #1a1610;
}
.section-accent {
  width: 6pt;
  height: 24pt;
  border-radius: 1pt;
  flex-shrink: 0;
}
.section-head-bp .section-accent       { background: #C96442; }
.section-head-hr .section-accent       { background: #C97C3D; }
.section-head-spo2 .section-accent     { background: #B89148; }
.section-head-sleep .section-accent    { background: #5848A0; }
.section-head-activity .section-accent { background: #7BA88F; }
.section-head-cross .section-accent    { background: #4A4339; }
.section-head-notes .section-accent    { background: #8b8378; }

h3.subheading {
  font-size: 10pt;
  margin: 6mm 0 2mm;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6a6256;
  font-weight: 500;
}

/* ── Charts ──────────────────────────────────────── */
svg.chart {
  display: block;
  width: 100%;
  height: auto;
  max-height: 56mm;
  margin: 0 0 5mm;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.05);
  border-radius: 3mm;
  padding: 4mm 2mm;
}
svg.chart-empty {
  background: rgba(0, 0, 0, 0.015);
  border: 1px dashed rgba(0, 0, 0, 0.1);
}

/* ── Stat cards ───────────────────────────────────── */
.stat-row { display: flex; gap: 6mm; margin: 4mm 0 6mm; }
.stat {
  flex: 1;
  padding: 4mm 5mm;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 3mm;
}
.stat-label {
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 8pt;
  color: #8b8378;
  margin-bottom: 2mm;
  font-weight: 500;
}
.stat-value {
  font-size: 22pt;
  font-weight: 500;
  font-family: 'Inter', system-ui, sans-serif;
  font-feature-settings: "tnum";
  color: #1a1610;
  line-height: 1.1;
}
.stat-value .unit {
  font-size: 11pt;
  color: #6a6256;
  font-weight: 400;
  margin-left: 2pt;
}

/* ── BP distribution bar ─────────────────────────── */
.dist-bar-wrap { margin: 2mm 0 4mm; }
svg.dist-bar { display: block; width: 100%; max-height: 8mm; border-radius: 2pt; overflow: hidden; }
.dist-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4mm 6mm;
  margin-top: 3mm;
}
.dist-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 2mm;
  font-size: 9pt;
  color: #4a4339;
}
.dist-swatch {
  display: inline-block;
  width: 8pt;
  height: 8pt;
  border-radius: 1.5pt;
}
.dist-legend-label { font-weight: 500; }
.dist-legend-count { color: #8b8378; font-feature-settings: "tnum"; }

/* ── Tables (preserved for tests + secondary detail) ─ */
.dist-table, .reading-table { width: 100%; border-collapse: collapse; margin: 3mm 0 6mm; }
.dist-table th, .reading-table th {
  text-align: left;
  font-size: 9pt;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8b8378;
  padding: 2mm 0;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  font-weight: 500;
}
.dist-table td, .reading-table td {
  padding: 2mm 0;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  font-size: 10.5pt;
  font-feature-settings: "tnum";
}

.muted { color: #6a6256; font-size: 11pt; font-style: italic; }

/* ── Cross-vital ─────────────────────────────────── */
.cross-vital-ai {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 13pt;
  line-height: 1.55;
  color: #2a241c;
  margin: 0 0 4mm;
  font-style: italic;
}
.correlation-card {
  padding: 6mm;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 3mm;
  margin-bottom: 4mm;
}
.correlation-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 9pt;
  color: #8b8378;
  margin: 0 0 2mm;
  font-weight: 500;
}
.correlation-body { margin: 0 0 3mm; font-size: 11pt; line-height: 1.55; }
.correlation-stat {
  font-size: 9pt;
  color: #8b8378;
  margin: 0;
  font-feature-settings: "tnum";
}

/* ── Notes ───────────────────────────────────────── */
.notes-list { padding-left: 0; margin: 0; list-style: none; }
.notes-list li {
  padding: 3mm 0;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  font-size: 11pt;
}
.note-day {
  font-feature-settings: "tnum";
  color: #8b8378;
  margin-right: 3mm;
  font-size: 9pt;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ── Page footer ─────────────────────────────────── */
.page-footer {
  margin: 10mm 0 0;
  padding-top: 4mm;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 8.5pt;
  color: #8b8378;
  text-align: center;
  letter-spacing: 0.04em;
  font-feature-settings: "tnum";
}
`;

export const _internal = {
  coverLine,
  reportTitle,
  haloEmberMark,
};

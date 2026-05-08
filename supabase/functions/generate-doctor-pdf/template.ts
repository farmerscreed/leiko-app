// HTML template builder for the doctor-ready PDF — Sprint 9.
//
// Produces the seven-section layout per D13 §10.2 + voice rules per
// docs/05-voice-and-claims.md + the "clinical but premium" tone called
// out in the spec. Styles are inlined as a single <style> block so the
// rasterizer (Puppeteer / Browserless / PDFShift / etc.) doesn't have
// to fetch external assets.
//
// Voice gate — every user-visible string in this file passes:
//   • No "patient", "diagnose", "treat", "predict", "dangerous", "critical",
//     "silent killer", "medical advice".
//   • Cover line per account_type:
//     - caregiver: "This report is general information from {parent}'s
//       Leiko watch. It is not a diagnosis. Please discuss with their
//       doctor."
//     - self_buyer: "This report is general information from your
//       Leiko watch. It is not a diagnosis. Please discuss with your doctor."

import type { ReportData, AccountType } from './types.ts';

export interface TemplateOptions {
  /** Render mode: html (default) or html-fragment (no doctype/html
   *  wrapper, useful for tests). Defaults to 'html'. */
  fragment?: boolean;
}

export function renderReport(
  data: ReportData,
  options: TemplateOptions = {},
): string {
  const body = `
${section('cover', renderCover(data))}
${section('bp', renderBP(data))}
${section('hr', renderHR(data))}
${section('spo2', renderSpO2(data))}
${section('sleep', renderSleep(data))}
${section('activity', renderActivity(data))}
${section('cross-vital', renderCrossVital(data))}
${section('notes', renderNotes(data))}
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

// ── Cover ───────────────────────────────────────────────────────────

function coverLine(accountType: AccountType, displayName: string): string {
  if (accountType === 'caregiver') {
    return `This report is general information from ${displayName}'s Leiko watch. It is not a diagnosis. Please discuss with their doctor.`;
  }
  // Self-buyer + parent-fallback both use second-person "your".
  return `This report is general information from your Leiko watch. It is not a diagnosis. Please discuss with your doctor.`;
}

function renderCover(data: ReportData): string {
  const ageLine = data.user.yearOfBirth
    ? `${new Date().getUTCFullYear() - data.user.yearOfBirth} years old`
    : '';
  return `
    <header class="cover">
      <p class="brand-eyebrow">Leiko · Pulse report</p>
      <h1 class="cover-headline">${escape(data.user.displayName)}</h1>
      <p class="cover-meta">${escape(data.rangeLabel)}${ageLine ? ' · ' + escape(ageLine) : ''}</p>
      <p class="cover-line">${escape(coverLine(data.user.accountType, data.user.displayName))}</p>
      <p class="generated-at">Generated ${escape(formatDate(data.generatedAtIso))}</p>
    </header>
  `;
}

// ── Vital sections ──────────────────────────────────────────────────

function renderBP(data: ReportData): string {
  const { avgSys, avgDia, pctInRange, distribution, topAbnormal, count } =
    data.bp;
  const summary = `
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average</span><span class="stat-value">${formatBP(avgSys, avgDia)} <span class="unit">mmHg</span></span></div>
      <div class="stat"><span class="stat-label">In range</span><span class="stat-value">${formatPct(pctInRange)}</span></div>
      <div class="stat"><span class="stat-label">Readings</span><span class="stat-value">${count}</span></div>
    </div>
  `;
  const dist = `
    <h3 class="subheading">Classification distribution</h3>
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
  const abnormal = topAbnormal.length === 0
    ? '<p class="muted">No readings outside the normal band over the period.</p>'
    : `
    <h3 class="subheading">Most abnormal readings</h3>
    <table class="reading-table">
      <thead><tr><th>Day</th><th>BP</th><th>Pulse</th><th>Category</th></tr></thead>
      <tbody>
        ${topAbnormal.map((r) => `
          <tr>
            <td>${escape(r.day)}</td>
            <td>${r.sys}/${r.dia}</td>
            <td>${r.pulse ?? '—'}</td>
            <td>${labelForBPClass(r.classification)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  return `
    <h2>Blood pressure</h2>
    ${summary}
    ${dist}
    ${abnormal}
  `;
}

function renderHR(data: ReportData): string {
  const { avgResting, count, points } = data.hr;
  if (count === 0) {
    return `
      <h2>Heart rate</h2>
      <p class="muted">No heart-rate samples over the period.</p>
    `;
  }
  return `
    <h2>Heart rate</h2>
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
      <h2>Blood oxygen (SpO2)</h2>
      <p class="muted">No blood-oxygen samples over the period.</p>
    `;
  }
  return `
    <h2>Blood oxygen (SpO2)</h2>
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
      <h2>Sleep</h2>
      <p class="muted">No sleep sessions recorded over the period.</p>
    `;
  }
  return `
    <h2>Sleep</h2>
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
      <h2>Activity</h2>
      <p class="muted">No activity samples over the period.</p>
    `;
  }
  return `
    <h2>Activity</h2>
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average daily steps</span><span class="stat-value">${formatSteps(avgSteps)}</span></div>
      <div class="stat"><span class="stat-label">Days observed</span><span class="stat-value">${points.length}</span></div>
    </div>
  `;
}

function renderCrossVital(data: ReportData): string {
  if (data.correlations.length === 0) {
    return `
      <h2>Cross-vital observations</h2>
      <p class="muted">No cross-vital patterns reached the meaningful threshold over the selected range.</p>
    `;
  }
  const cards = data.correlations.map((c) => `
    <div class="correlation-card">
      <p class="correlation-eyebrow">${escape(eyebrowFor(c.correlation_type))}</p>
      <p class="correlation-body">${escape(c.narrative_long ?? '')}</p>
      <p class="correlation-stat">n = ${c.sample_n ?? 0}${c.pearson_r === null ? '' : ` · r = ${c.pearson_r.toFixed(2)}`}</p>
    </div>
  `).join('');
  return `
    <h2>Cross-vital observations</h2>
    ${cards}
  `;
}

function renderNotes(data: ReportData): string {
  if (data.notes.length === 0) {
    return `
      <h2>Notes</h2>
      <p class="muted">No notes attached to readings in this range.</p>
    `;
  }
  return `
    <h2>Notes</h2>
    <ul class="notes-list">
      ${data.notes.map((n) => `<li><span class="note-day">${escape(n.day)}</span> ${escape(n.body)}</li>`).join('')}
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
section { padding: 14mm 0 6mm; page-break-inside: avoid; }
section.report-cover { padding: 30mm 0 14mm; text-align: center; page-break-after: always; }
section.report-bp,
section.report-hr,
section.report-spo2,
section.report-sleep,
section.report-activity,
section.report-cross-vital,
section.report-notes { page-break-inside: avoid; }

h1, h2, h3 { font-weight: 600; color: #1a1610; }
.cover-headline { font-family: 'Instrument Serif', Georgia, serif; font-size: 32pt; line-height: 1.05; margin: 0 0 6mm; font-weight: 400; }
h2 { font-size: 16pt; margin: 0 0 4mm; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 2mm; }
h3.subheading { font-size: 11pt; margin: 6mm 0 2mm; text-transform: uppercase; letter-spacing: 0.06em; color: #6a6256; font-weight: 500; }

.brand-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 9pt;
  color: #b07a3c;
  margin: 0 0 6mm;
  font-weight: 500;
}
.cover-meta { font-size: 12pt; color: #4a4339; margin: 0 0 10mm; }
.cover-line { font-style: italic; color: #4a4339; max-width: 130mm; margin: 0 auto 12mm; }
.generated-at { font-size: 9pt; color: #8b8378; margin: 0; }

.stat-row { display: flex; gap: 8mm; margin: 4mm 0 6mm; }
.stat { flex: 1; padding: 4mm; background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 3mm; }
.stat-label { display: block; text-transform: uppercase; letter-spacing: 0.08em; font-size: 8pt; color: #8b8378; margin-bottom: 2mm; }
.stat-value { font-size: 20pt; font-weight: 500; font-family: 'Inter', system-ui, sans-serif; font-feature-settings: "tnum"; color: #1a1610; }
.stat-value .unit { font-size: 11pt; color: #6a6256; font-weight: 400; }

.dist-table, .reading-table { width: 100%; border-collapse: collapse; margin: 2mm 0 6mm; }
.dist-table th, .reading-table th { text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; color: #8b8378; padding: 2mm 0; border-bottom: 1px solid rgba(0,0,0,0.08); font-weight: 500; }
.dist-table td, .reading-table td { padding: 2mm 0; border-bottom: 1px solid rgba(0,0,0,0.04); font-size: 11pt; }

.muted { color: #6a6256; font-size: 11pt; font-style: italic; }

.correlation-card { padding: 6mm; background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 3mm; margin-bottom: 4mm; }
.correlation-eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 9pt; color: #8b8378; margin: 0 0 2mm; font-weight: 500; }
.correlation-body { margin: 0 0 3mm; font-size: 11pt; line-height: 1.55; }
.correlation-stat { font-size: 9pt; color: #8b8378; margin: 0; font-feature-settings: "tnum"; }

.notes-list { padding-left: 0; margin: 0; list-style: none; }
.notes-list li { padding: 2mm 0; border-bottom: 1px solid rgba(0,0,0,0.04); font-size: 11pt; }
.note-day { font-feature-settings: "tnum"; color: #8b8378; margin-right: 3mm; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; }
`;

export const _internal = {
  coverLine,
  reportTitle,
};

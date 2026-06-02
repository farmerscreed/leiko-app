// HTML template builder for the doctor-ready PDF.
// Sprint 9 (core) · Sprint 19 Block 10 (visual polish + SVG charts)
// · Sprint 19 PDF v2 (clinical depth pass).
//
// Sprint 19 PDF v2 changes (commissioned 2026-05-24 after on-device
// review of the first real-data PDF):
//   - Always-rendered Executive Summary on the cover: 5-vital tile
//     grid + bulleted key findings. PDF is useful even when the AI
//     paragraph is absent (e.g., Anthropic credits empty).
//   - Per-vital "Clinical context" paragraphs under each section
//     header — deterministic 2-3 sentence interpretation built by
//     data.ts. No AI dependency.
//   - Insufficient-data state per vital: replaces averages/charts
//     with a callout when sample count is below the per-vital
//     threshold (3 nights, 3 days, 5 BP readings).
//   - Flag column on the BP abnormal table — surfaces bradycardia,
//     tachycardia, elevated pulse pressure, narrow pulse pressure.
//   - Reference-band footnote per section (cites ACC/AHA, AHA
//     adult-resting-HR, SpO2, sleep refs).
//   - Cross-vital observations: shows a data-sufficiency footnote
//     when the correlation engine has no meaningful patterns yet.
//   - Optional Clinical Context block on the cover (medications,
//     symptoms, target BP — collected by the mobile screen).
//   - Page-header running identifier on pages 2+ (display name · age
//     · range).
//   - Density: only the cover, BP, and Notes sections force a page
//     break. Lighter sections flow inline so a sparse PDF doesn't
//     bloat to 8 mostly-empty pages.
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
import type {
  AccountType,
  ClinicalContext,
  ExecutiveSummary,
  ReadingFlag,
  ReportData,
  VitalSufficiency,
} from './types.ts';

export interface TemplateOptions {
  /** Render mode: html (default) or html-fragment (no doctype/html
   *  wrapper, useful for tests). Defaults to 'html'. */
  fragment?: boolean;
}

export function renderReport(
  data: ReportData,
  options: TemplateOptions = {},
): string {
  const runningHeader = renderRunningHeader(data);
  const body = `
${section('cover', renderCover(data))}
${section('bp', runningHeader + renderBP(data))}
${section('hr', runningHeader + renderHR(data))}
${section('spo2', runningHeader + renderSpO2(data))}
${section('sleep', runningHeader + renderSleep(data))}
${section('activity', runningHeader + renderActivity(data))}
${section('cross-vital', runningHeader + renderCrossVital(data))}
${section('notes', runningHeader + renderNotes(data))}
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

/** Sprint 19 PDF v2 — repeating identifier on pages 2-8 so a printed
 *  report folded into a binder always carries the subject + scope. */
function renderRunningHeader(data: ReportData): string {
  const age = data.user.yearOfBirth
    ? ` · ${new Date().getUTCFullYear() - data.user.yearOfBirth} yo`
    : '';
  return `<div class="page-header">${escape(data.user.displayName)}${age} · ${escape(data.rangeLabel)}</div>`;
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
      ${renderExecutiveSummary(data.executiveSummary)}
      ${renderClinicalFields(data)}
      ${note}
      <p class="cover-line">${escape(coverLine(data.user.accountType, data.user.displayName))}</p>
      <p class="generated-at">Generated ${escape(formatDate(data.generatedAtIso))}</p>
    </header>
  `;
}

function renderExecutiveSummary(summary: ExecutiveSummary): string {
  const tile = (label: string, value: string): string =>
    `<div class="exec-tile"><p class="exec-tile-label">${escape(label)}</p><p class="exec-tile-value">${escape(value)}</p></div>`;
  const tiles = [
    tile('Blood pressure', summary.bpHeadline),
    tile('Heart rate', summary.hrHeadline),
    tile('Blood oxygen', summary.spo2Headline),
    tile('Sleep', summary.sleepHeadline),
    tile('Activity', summary.activityHeadline),
  ].join('');

  const findings = summary.keyFindings.length === 0
    ? ''
    : `<div class="key-findings">
        <p class="key-findings-eyebrow">Key findings</p>
        <ul>${summary.keyFindings.map((f) => `<li>${escape(f)}</li>`).join('')}</ul>
      </div>`;

  return `
    <section class="exec-summary" aria-label="Executive summary">
      <p class="exec-eyebrow">At a glance</p>
      <div class="exec-grid">${tiles}</div>
      ${findings}
    </section>
  `;
}

function renderClinicalFields(data: ReportData): string {
  const cf = data.clinicalFields;
  if (!cf) return '';
  const row = (label: string, value: string | undefined): string => {
    if (!value) return '';
    return `<div class="clinical-row"><p class="clinical-label">${escape(label)}</p><p class="clinical-value">${escape(value)}</p></div>`;
  };
  const rows = [
    row('Current medications', cf.medications),
    row('Recent symptoms', cf.symptoms),
    row('Target BP', cf.targetBp),
  ].join('');
  if (!rows) return '';
  return `
    <section class="clinical-fields" aria-label="Clinical context">
      <p class="clinical-eyebrow">Clinical context</p>
      ${rows}
    </section>
  `;
}

// ── Vital sections ──────────────────────────────────────────────────

function renderSectionHeader(label: string, vital: string, sufficiency?: VitalSufficiency): string {
  const suffix = sufficiency
    ? `<span class="section-suffix">· ${escape(sufficiency.label)}</span>`
    : '';
  return `<div class="section-head section-head-${vital}"><span class="section-accent"></span><h2>${escape(label)}</h2>${suffix}</div>`;
}

function renderClinicalContext(ctx: ClinicalContext): string {
  if (!ctx.paragraphs || ctx.paragraphs.length === 0) return '';
  return `<div class="clinical-context">${ctx.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('')}</div>`;
}

function renderRefFootnote(text: string): string {
  return `<p class="ref-footnote">${escape(text)}</p>`;
}

function renderInsufficient(vital: string, sufficiency: VitalSufficiency, label: string): string {
  return `
    ${renderSectionHeader(label, vital, sufficiency)}
    <p class="muted insufficient">Not enough data over this range to characterise a pattern. ${escape(sufficiency.label)}</p>
  `;
}

function renderBP(data: ReportData): string {
  const { avgSys, avgDia, pctInRange, distribution, topAbnormal, count, points, sufficiency } = data.bp;
  if (count === 0) {
    return `
      ${renderSectionHeader('Blood pressure', 'bp', sufficiency)}
      <p class="muted">No blood-pressure readings in this range.</p>
    `;
  }
  if (sufficiency.level === 'insufficient') {
    return `
      ${renderInsufficient('bp', sufficiency, 'Blood pressure')}
      ${renderClinicalContext(data.bp.clinicalContext)}
      ${renderRefFootnote('Reference: ACC/AHA 2017 categories — Stage 1 ≥130/80, Stage 2 ≥140/90, Crisis ≥180/120.')}
    `;
  }
  const chart = renderBpTrendChart(points);
  const ppTile = data.bp.avgPulsePressure !== null
    ? `<div class="stat"><span class="stat-label">Pulse pressure (avg)</span><span class="stat-value">${data.bp.avgPulsePressure} <span class="unit">mmHg</span></span></div>`
    : '';
  const summary = `
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average</span><span class="stat-value">${formatBP(avgSys, avgDia)} <span class="unit">mmHg</span></span></div>
      <div class="stat"><span class="stat-label">In range</span><span class="stat-value">${formatPct(pctInRange)}</span></div>
      <div class="stat"><span class="stat-label">Readings</span><span class="stat-value">${count}</span></div>
      ${ppTile}
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
      <thead><tr><th>Day</th><th>BP</th><th>Pulse</th><th>Category</th><th>Flags</th></tr></thead>
      <tbody>
        ${topAbnormal
          .map(
            (r) => `
          <tr>
            <td>${escape(r.day)}</td>
            <td>${r.sys}/${r.dia}</td>
            <td>${r.pulse ?? '—'}</td>
            <td>${labelForBPClass(r.classification)}</td>
            <td>${renderFlags(r.flags)}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `;
  return `
    ${renderSectionHeader('Blood pressure', 'bp', sufficiency)}
    ${renderClinicalContext(data.bp.clinicalContext)}
    ${chart}
    ${summary}
    ${dist}
    ${abnormal}
    ${renderRefFootnote('Reference: ACC/AHA 2017 categories — Stage 1 ≥130/80, Stage 2 ≥140/90, Crisis ≥180/120. Leiko "in range" band: 90–135 systolic / 60–85 diastolic.')}
  `;
}

function renderFlags(flags: ReadingFlag[]): string {
  if (!flags || flags.length === 0) return '—';
  return flags
    .map((f) => `<span class="flag-chip flag-${f.reason.replace(/_/g, '-')}">${escape(f.label)}</span>`)
    .join(' ');
}

function renderHR(data: ReportData): string {
  const { avgResting, count, points, sufficiency } = data.hr;
  if (count === 0) {
    return `
      ${renderSectionHeader('Heart rate', 'hr', sufficiency)}
      <p class="muted">No heart-rate samples over the period.</p>
    `;
  }
  if (sufficiency.level === 'insufficient') {
    return `
      ${renderInsufficient('hr', sufficiency, 'Heart rate')}
      ${renderClinicalContext(data.hr.clinicalContext)}
      ${renderRefFootnote('Reference: AHA adult resting heart rate 60–100 bpm.')}
    `;
  }
  const rangeTile = (data.hr.minObserved !== null && data.hr.maxObserved !== null)
    ? `<div class="stat"><span class="stat-label">Observed range</span><span class="stat-value">${data.hr.minObserved}–${data.hr.maxObserved} <span class="unit">bpm</span></span></div>`
    : '';
  return `
    ${renderSectionHeader('Heart rate', 'hr', sufficiency)}
    ${renderClinicalContext(data.hr.clinicalContext)}
    ${renderHrTrendChart(points)}
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average resting</span><span class="stat-value">${formatBpm(avgResting)} <span class="unit">bpm</span></span></div>
      ${rangeTile}
      <div class="stat"><span class="stat-label">Days observed</span><span class="stat-value">${points.length}</span></div>
      <div class="stat"><span class="stat-label">Samples</span><span class="stat-value">${count}</span></div>
    </div>
    ${renderRefFootnote('Reference: AHA adult resting heart rate 60–100 bpm. Trained athletes commonly run lower.')}
  `;
}

function renderSpO2(data: ReportData): string {
  const { avgMinPercent, daysBelow90, count, points, sufficiency } = data.spo2;
  if (count === 0) {
    return `
      ${renderSectionHeader('Blood oxygen (SpO2)', 'spo2', sufficiency)}
      <p class="muted">No blood-oxygen samples over the period.</p>
    `;
  }
  if (sufficiency.level === 'insufficient') {
    return `
      ${renderInsufficient('spo2', sufficiency, 'Blood oxygen (SpO2)')}
      ${renderClinicalContext(data.spo2.clinicalContext)}
      ${renderRefFootnote('Reference: SpO2 ≥95% typical; <93% noted as desaturation event for this report.')}
    `;
  }
  const minTile = data.spo2.minObserved !== null
    ? `<div class="stat"><span class="stat-label">Lowest observed</span><span class="stat-value">${data.spo2.minObserved}<span class="unit">%</span></span></div>`
    : '';
  const eventsTile = `<div class="stat"><span class="stat-label">Events &lt; 93%</span><span class="stat-value">${data.spo2.eventsBelow93}</span></div>`;
  return `
    ${renderSectionHeader('Blood oxygen (SpO2)', 'spo2', sufficiency)}
    ${renderClinicalContext(data.spo2.clinicalContext)}
    ${renderSpO2TrendChart(points)}
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average overnight low</span><span class="stat-value">${formatPercent(avgMinPercent)}</span></div>
      ${minTile}
      ${eventsTile}
      <div class="stat"><span class="stat-label">Days below 90%</span><span class="stat-value">${daysBelow90}</span></div>
    </div>
    ${renderRefFootnote('Reference: SpO2 ≥95% typical for healthy adults. Sustained <93% during sleep is a common screening trigger.')}
  `;
}

function renderSleep(data: ReportData): string {
  const { avgTotalMinutes, count, points, sufficiency } = data.sleep;
  if (count === 0) {
    return `
      ${renderSectionHeader('Sleep', 'sleep', sufficiency)}
      <p class="muted">No sleep sessions recorded over the period.</p>
    `;
  }
  if (sufficiency.level === 'insufficient') {
    return `
      ${renderInsufficient('sleep', sufficiency, 'Sleep')}
      ${renderClinicalContext(data.sleep.clinicalContext)}
      ${renderRefFootnote('Reference: NSF adult sleep 7–9 hours/night. Single-night values are reported but should not be over-interpreted.')}
    `;
  }
  return `
    ${renderSectionHeader('Sleep', 'sleep', sufficiency)}
    ${renderClinicalContext(data.sleep.clinicalContext)}
    ${renderSleepStackedBars(points)}
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average total</span><span class="stat-value">${formatHM(avgTotalMinutes)}</span></div>
      <div class="stat"><span class="stat-label">Nights observed</span><span class="stat-value">${points.length}</span></div>
    </div>
    ${renderRefFootnote('Reference: NSF adult sleep 7–9 hours/night. Deep-sleep percentage typically 13–23% of total.')}
  `;
}

function renderActivity(data: ReportData): string {
  const { avgSteps, count, points, sufficiency } = data.activity;
  if (count === 0) {
    return `
      ${renderSectionHeader('Activity', 'activity', sufficiency)}
      <p class="muted">No activity samples over the period.</p>
    `;
  }
  if (sufficiency.level === 'insufficient') {
    return `
      ${renderInsufficient('activity', sufficiency, 'Activity')}
      ${renderClinicalContext(data.activity.clinicalContext)}
      ${renderRefFootnote('Reference: 6,000 steps/day used as the active threshold for this report.')}
    `;
  }
  return `
    ${renderSectionHeader('Activity', 'activity', sufficiency)}
    ${renderClinicalContext(data.activity.clinicalContext)}
    ${renderActivityBars(points)}
    <div class="stat-row">
      <div class="stat"><span class="stat-label">Average daily steps</span><span class="stat-value">${formatSteps(avgSteps)}</span></div>
      <div class="stat"><span class="stat-label">Days at target</span><span class="stat-value">${data.activity.daysAtTarget}/${points.length}</span></div>
      <div class="stat"><span class="stat-label">Days observed</span><span class="stat-value">${points.length}</span></div>
    </div>
    ${renderRefFootnote('Reference: 6,000 steps/day used as the active threshold for this report. WHO guideline: ≥150 min moderate activity/week.')}
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
    const sufficiencyNote = '<p class="muted">No cross-vital correlations reached the meaningful threshold yet. Patterns surface once there are enough paired days of data across vitals (typically two or more weeks of overlapping BP + sleep + activity).</p>';
    return `
      ${renderSectionHeader('Cross-vital observations', 'cross')}
      ${aiObs}
      ${sufficiencyNote}
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
    case 'normal': return 'Normal';
    case 'elevated': return 'Elevated';
    case 'stage1': return 'Stage 1';
    case 'stage2': return 'Stage 2';
    case 'crisis': return 'Crisis';
    default: return c;
  }
}

function eyebrowFor(type: string): string {
  switch (type) {
    case 'sleep_x_morning_bp': return 'Sleep · Blood pressure';
    case 'activity_x_resting_hr': return 'Activity · Heart rate';
    case 'spo2_dip_x_sleep_score': return 'SpO2 · Sleep';
    default: return type;
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

/* Sprint 19 PDF v2 density: only the cover, BP (dense), and Notes
   sections force a page break. Lighter sections (HR / SpO2 / Sleep /
   Activity / Cross-vital) flow inline so a sparse report doesn't
   bloat to 8 mostly-empty pages. */
section { padding: 8mm 0 6mm; page-break-inside: avoid; }
section.report-cover { padding: 18mm 0 12mm; text-align: center; page-break-after: always; }
section.report-bp { page-break-before: always; }
section.report-notes { page-break-before: avoid; }

/* ── Running page header (pages 2+) ─────────────────────────── */
.page-header {
  font-size: 8.5pt;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8b8378;
  border-bottom: 0.5pt solid rgba(0,0,0,0.08);
  padding-bottom: 2mm;
  margin-bottom: 4mm;
  font-feature-settings: "tnum";
}

/* ── Cover ────────────────────────────────────────── */
.cover-mark { margin: 0 auto 6mm; line-height: 0; }
.brand-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 9pt;
  color: #C96442;
  margin: 0 0 5mm;
  font-weight: 500;
}
.cover-headline {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 32pt;
  line-height: 1.05;
  margin: 0 0 3mm;
  font-weight: 400;
  letter-spacing: -0.5pt;
  color: #1a1610;
}
.cover-meta {
  font-size: 11pt;
  color: #4a4339;
  margin: 0 0 6mm;
  font-feature-settings: "tnum";
}
.cover-ai {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 13pt;
  line-height: 1.5;
  color: #2a241c;
  max-width: 140mm;
  margin: 0 auto 6mm;
  text-align: left;
  font-style: italic;
}
.cover-note {
  max-width: 140mm;
  margin: 0 auto 6mm;
  padding: 4mm 5mm;
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
  margin: 6mm auto 8mm;
  font-size: 9.5pt;
  line-height: 1.5;
}
.generated-at {
  font-size: 9pt;
  color: #8b8378;
  margin: 0;
  font-feature-settings: "tnum";
}

/* ── Executive summary (cover) ───────────────────────────── */
.exec-summary {
  text-align: left;
  max-width: 165mm;
  margin: 4mm auto 6mm;
  padding: 6mm 6mm 5mm;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 4mm;
}
.exec-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 8.5pt;
  color: #8b8378;
  margin: 0 0 4mm;
  font-weight: 500;
}
.exec-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 3mm;
  margin-bottom: 5mm;
}
.exec-tile {
  padding: 3mm 3mm;
  background: #fbf8f3;
  border-radius: 2.5mm;
  border: 1px solid rgba(0,0,0,0.04);
}
.exec-tile-label {
  font-size: 8pt;
  color: #8b8378;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 1.5mm;
  font-weight: 500;
}
.exec-tile-value {
  font-size: 9.5pt;
  color: #1a1610;
  margin: 0;
  font-weight: 500;
  font-feature-settings: "tnum";
  line-height: 1.3;
}
.key-findings {
  border-top: 1px solid rgba(0,0,0,0.06);
  padding-top: 4mm;
}
.key-findings-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 8.5pt;
  color: #C96442;
  margin: 0 0 2mm;
  font-weight: 500;
}
.key-findings ul {
  margin: 0;
  padding-left: 5mm;
  color: #2a241c;
  font-size: 10pt;
  line-height: 1.55;
}
.key-findings li { margin-bottom: 1.5mm; }

/* ── Clinical context fields (cover, optional) ──────────── */
.clinical-fields {
  text-align: left;
  max-width: 165mm;
  margin: 0 auto 6mm;
  padding: 5mm 6mm;
  background: rgba(184, 209, 188, 0.08);
  border: 1px solid rgba(123, 168, 143, 0.18);
  border-radius: 3mm;
}
.clinical-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 8.5pt;
  color: #4a6952;
  margin: 0 0 3mm;
  font-weight: 500;
}
.clinical-row { margin-bottom: 2.5mm; }
.clinical-row:last-child { margin-bottom: 0; }
.clinical-label {
  font-size: 8.5pt;
  color: #6a6256;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 0.5mm;
  font-weight: 500;
}
.clinical-value {
  font-size: 10pt;
  color: #1a1610;
  margin: 0;
  line-height: 1.5;
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
  font-size: 15pt;
  font-weight: 600;
  color: #1a1610;
}
.section-suffix {
  font-size: 9pt;
  color: #8b8378;
  font-weight: 400;
  font-feature-settings: "tnum";
}
.section-accent {
  width: 6pt;
  height: 22pt;
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
  margin: 5mm 0 2mm;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6a6256;
  font-weight: 500;
}

/* ── Clinical context paragraphs ────────────────────────── */
.clinical-context {
  margin: 0 0 4mm;
}
.clinical-context p {
  margin: 0 0 2mm;
  font-size: 10.5pt;
  line-height: 1.55;
  color: #2a241c;
}
.clinical-context p:last-child { margin-bottom: 0; }

/* ── Reference footnotes ─────────────────────────────────── */
.ref-footnote {
  font-size: 8.5pt;
  color: #8b8378;
  margin: 4mm 0 0;
  padding-top: 2mm;
  border-top: 1px dashed rgba(0,0,0,0.08);
  line-height: 1.4;
  font-style: italic;
}

/* ── Insufficient-data callout ───────────────────────────── */
.insufficient {
  background: rgba(232, 160, 99, 0.05);
  border-left: 2pt solid #E8A063;
  padding: 3mm 4mm;
  border-radius: 0 2mm 2mm 0;
  margin: 2mm 0 4mm;
}

/* ── Charts ──────────────────────────────────────── */
svg.chart {
  display: block;
  width: 100%;
  height: auto;
  max-height: 52mm;
  margin: 0 0 4mm;
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
.stat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4mm;
  margin: 3mm 0 5mm;
}
.stat {
  flex: 1 1 30%;
  min-width: 38mm;
  padding: 3mm 4mm;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 3mm;
}
.stat-label {
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 7.5pt;
  color: #8b8378;
  margin-bottom: 1.5mm;
  font-weight: 500;
}
.stat-value {
  font-size: 18pt;
  font-weight: 500;
  font-family: 'Inter', system-ui, sans-serif;
  font-feature-settings: "tnum";
  color: #1a1610;
  line-height: 1.1;
}
.stat-value .unit {
  font-size: 10pt;
  color: #6a6256;
  font-weight: 400;
  margin-left: 1pt;
}

/* ── BP distribution bar ─────────────────────────── */
.dist-bar-wrap { margin: 2mm 0 4mm; }
svg.dist-bar { display: block; width: 100%; max-height: 7mm; border-radius: 2pt; overflow: hidden; }
.dist-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 3mm 5mm;
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

/* ── Tables ──────────────────────────────────────── */
.dist-table, .reading-table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; }
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
  padding: 2mm 4mm 2mm 0;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  font-size: 10pt;
  font-feature-settings: "tnum";
}

/* ── Flag chips on the BP abnormal table ─────────────────── */
.flag-chip {
  display: inline-block;
  font-size: 8.5pt;
  font-weight: 500;
  letter-spacing: 0.02em;
  padding: 1pt 5pt;
  border-radius: 2.5mm;
  margin-right: 2pt;
  white-space: nowrap;
}
.flag-bradycardia { background: rgba(110, 91, 170, 0.14); color: #4F3D8B; }
.flag-tachycardia { background: rgba(201, 100, 66, 0.14); color: #7A2F1C; }
.flag-elevated-pp { background: rgba(184, 145, 72, 0.16); color: #6B5224; }
.flag-narrow-pp   { background: rgba(74, 105, 82, 0.14); color: #2F4737; }

.muted { color: #6a6256; font-size: 10.5pt; font-style: italic; }

/* ── Cross-vital ─────────────────────────────────── */
.cross-vital-ai {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 12pt;
  line-height: 1.55;
  color: #2a241c;
  margin: 0 0 3mm;
  font-style: italic;
}
.correlation-card {
  padding: 4mm 5mm;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 3mm;
  margin: 0 0 3mm;
}
.correlation-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 8.5pt;
  color: #4A4339;
  margin: 0 0 1.5mm;
  font-weight: 500;
}
.correlation-body {
  font-size: 10.5pt;
  color: #2a241c;
  margin: 0 0 1mm;
  line-height: 1.5;
}
.correlation-stat {
  font-size: 9pt;
  color: #8b8378;
  font-feature-settings: "tnum";
  margin: 0;
}

/* ── Notes list ──────────────────────────────────── */
.notes-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.notes-list li {
  font-size: 10.5pt;
  line-height: 1.55;
  color: #2a241c;
  margin: 0 0 2.5mm;
  padding-bottom: 2.5mm;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}
.notes-list li:last-child { border-bottom: none; }
.note-day {
  font-size: 8.5pt;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8b8378;
  margin-right: 3mm;
  font-feature-settings: "tnum";
}
`;

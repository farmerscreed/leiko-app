// charts.ts — inline SVG chart helpers for the doctor PDF.
// Sprint 19 Block 10.
//
// Pure functions returning SVG strings. No deps — generated SVG is
// embedded directly in the HTML body and rendered by the rasterizer
// (PDFShift / Browserless / Puppeteer) at print quality.
//
// Conventions:
//   - All charts are 480pt wide × 160pt tall (fits Letter at 18mm
//     margins with breathing room).
//   - Axes are minimal: a faint horizontal baseline + day-tick labels
//     at the start/middle/end only (no clutter).
//   - Per-vital colours match the in-app palette:
//       BP        #E8A063 (coral)         + #C96442 (deep coral)
//       HR        #F5B98C (warm amber)
//       SpO2      #C9A35C (gold)
//       Sleep     #6E5BAA (indigo)        + #A695CC (light indigo)
//       Activity  #7BA88F (sage)
//   - Empty / single-point series render a neutral "Not enough data
//     yet" placeholder instead of a misleading flat line.
//
// Voice rules don't apply here (no user-visible strings beyond axis
// labels). Date labels are kept short (e.g. "Apr 8") and locale-neutral.

import type {
  ActivityDayPoint,
  BPClassDistribution,
  BPDayPoint,
  HRDayPoint,
  SleepDayPoint,
  SpO2DayPoint,
} from './types.ts';

const CHART_W = 480;
const CHART_H = 160;
const PAD_TOP = 12;
const PAD_BOTTOM = 26; // room for x-axis labels
const PAD_LEFT = 36; // room for y-axis labels
const PAD_RIGHT = 8;
const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM;

const COLOURS = {
  bpSys: '#C96442',
  bpDia: '#E8A063',
  hr: '#C97C3D',
  spo2: '#B89148',
  spo2Baseline: '#D9C68A',
  sleepDeep: '#5848A0',
  sleepLight: '#A695CC',
  activity: '#7BA88F',
  axisLine: 'rgba(26,22,16,0.18)',
  axisLabel: '#8b8378',
  baseline: 'rgba(26,22,16,0.10)',
  empty: '#b8b2aa',
} as const;

// ── Shared helpers ──────────────────────────────────────────────────

function svgOpen(extraClass = ''): string {
  return `<svg class="chart ${extraClass}" viewBox="0 0 ${CHART_W} ${CHART_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">`;
}

function emptyChart(message: string): string {
  return `${svgOpen('chart-empty')}
    <rect x="0" y="0" width="${CHART_W}" height="${CHART_H}" fill="transparent"/>
    <text x="${CHART_W / 2}" y="${CHART_H / 2}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, sans-serif" font-size="11" fill="${COLOURS.empty}">${escapeXml(message)}</text>
  </svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function shortDay(day: string): string {
  // 'YYYY-MM-DD' → 'Apr 8'
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}`;
}

function xAt(index: number, total: number): number {
  if (total <= 1) return PAD_LEFT + PLOT_W / 2;
  return PAD_LEFT + (index / (total - 1)) * PLOT_W;
}

function yAt(value: number, min: number, max: number): number {
  if (max === min) return PAD_TOP + PLOT_H / 2;
  const clamped = Math.max(min, Math.min(max, value));
  return PAD_TOP + PLOT_H - ((clamped - min) / (max - min)) * PLOT_H;
}

function renderXAxisLabels(days: string[]): string {
  if (days.length === 0) return '';
  const positions =
    days.length === 1
      ? [0]
      : days.length === 2
        ? [0, days.length - 1]
        : [0, Math.floor(days.length / 2), days.length - 1];
  const baseline = CHART_H - PAD_BOTTOM + 4;
  return (
    `<line x1="${PAD_LEFT}" y1="${CHART_H - PAD_BOTTOM}" x2="${CHART_W - PAD_RIGHT}" y2="${CHART_H - PAD_BOTTOM}" stroke="${COLOURS.axisLine}" stroke-width="0.5"/>` +
    positions
      .map((idx) => {
        const x = xAt(idx, days.length);
        return `<text x="${x}" y="${baseline + 10}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">${escapeXml(shortDay(days[idx]))}</text>`;
      })
      .join('')
  );
}

function renderYAxisLabels(min: number, max: number, unit = ''): string {
  if (min === max) {
    return `<text x="${PAD_LEFT - 6}" y="${PAD_TOP + PLOT_H / 2}" text-anchor="end" dominant-baseline="middle" font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">${Math.round(min)}${unit}</text>`;
  }
  const mid = Math.round((min + max) / 2);
  return (
    `<text x="${PAD_LEFT - 6}" y="${PAD_TOP + 4}" text-anchor="end" font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">${Math.round(max)}${unit}</text>` +
    `<text x="${PAD_LEFT - 6}" y="${PAD_TOP + PLOT_H / 2 + 3}" text-anchor="end" font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">${mid}${unit}</text>` +
    `<text x="${PAD_LEFT - 6}" y="${CHART_H - PAD_BOTTOM}" text-anchor="end" font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">${Math.round(min)}${unit}</text>`
  );
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

// ── BP twin-line trend ─────────────────────────────────────────────

export function renderBpTrendChart(points: ReadonlyArray<BPDayPoint>): string {
  const usable = points.filter((p) => p.sys > 0 && p.dia > 0);
  if (usable.length < 2) return emptyChart('Not enough readings to chart yet.');

  const all = usable.flatMap((p) => [p.sys, p.dia]);
  // Anchor the scale around clinically meaningful ranges so a healthy
  // band hugs neither edge: cap min at 50 (diastolic floor), max at 200.
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const min = Math.max(40, Math.floor((rawMin - 5) / 5) * 5);
  const max = Math.min(220, Math.ceil((rawMax + 5) / 5) * 5);

  const days = usable.map((p) => p.day);
  const sysPoints = usable.map((p, i) => ({
    x: xAt(i, usable.length),
    y: yAt(p.sys, min, max),
  }));
  const diaPoints = usable.map((p, i) => ({
    x: xAt(i, usable.length),
    y: yAt(p.dia, min, max),
  }));

  // Healthy-band shading: 90-120 systolic. Only render the band if it
  // overlaps the visible y-range.
  const bandTop = yAt(120, min, max);
  const bandBottom = yAt(90, min, max);
  const bandPath = bandTop < bandBottom
    ? `<rect x="${PAD_LEFT}" y="${bandTop}" width="${PLOT_W}" height="${bandBottom - bandTop}" fill="rgba(123,168,143,0.10)"/>`
    : '';

  return `${svgOpen('chart-bp')}
    ${bandPath}
    ${renderYAxisLabels(min, max)}
    ${renderXAxisLabels(days)}
    <path d="${buildPath(sysPoints)}" fill="none" stroke="${COLOURS.bpSys}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${buildPath(diaPoints)}" fill="none" stroke="${COLOURS.bpDia}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${sysPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="${COLOURS.bpSys}"/>`).join('')}
    ${diaPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="${COLOURS.bpDia}"/>`).join('')}
    <g font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">
      <rect x="${CHART_W - PAD_RIGHT - 80}" y="${PAD_TOP - 2}" width="80" height="14" fill="rgba(251,248,243,0.85)" rx="2"/>
      <circle cx="${CHART_W - PAD_RIGHT - 70}" cy="${PAD_TOP + 5}" r="3" fill="${COLOURS.bpSys}"/>
      <text x="${CHART_W - PAD_RIGHT - 62}" y="${PAD_TOP + 8}">Systolic</text>
      <circle cx="${CHART_W - PAD_RIGHT - 28}" cy="${PAD_TOP + 5}" r="3" fill="${COLOURS.bpDia}"/>
      <text x="${CHART_W - PAD_RIGHT - 20}" y="${PAD_TOP + 8}">Diastolic</text>
    </g>
  </svg>`;
}

// ── HR resting trend ───────────────────────────────────────────────

export function renderHrTrendChart(points: ReadonlyArray<HRDayPoint>): string {
  const usable = points.filter((p): p is HRDayPoint & { restingBpm: number } =>
    typeof p.restingBpm === 'number',
  );
  if (usable.length < 2) return emptyChart('Not enough resting samples to chart yet.');

  const vals = usable.map((p) => p.restingBpm);
  const min = Math.max(30, Math.floor((Math.min(...vals) - 5) / 5) * 5);
  const max = Math.min(180, Math.ceil((Math.max(...vals) + 5) / 5) * 5);

  const days = usable.map((p) => p.day);
  const hrPoints = usable.map((p, i) => ({
    x: xAt(i, usable.length),
    y: yAt(p.restingBpm, min, max),
  }));

  return `${svgOpen('chart-hr')}
    ${renderYAxisLabels(min, max)}
    ${renderXAxisLabels(days)}
    <path d="${buildPath(hrPoints)}" fill="none" stroke="${COLOURS.hr}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${hrPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="${COLOURS.hr}"/>`).join('')}
  </svg>`;
}

// ── SpO2 trend with 90% baseline ───────────────────────────────────

export function renderSpO2TrendChart(points: ReadonlyArray<SpO2DayPoint>): string {
  const usable = points.filter(
    (p): p is SpO2DayPoint & { minPercent: number } =>
      typeof p.minPercent === 'number',
  );
  if (usable.length < 2) return emptyChart('Not enough oxygen samples to chart yet.');

  // SpO2 lives in a narrow band — fix the scale at 80-100 so dips
  // below 90 are visually obvious.
  const min = 80;
  const max = 100;
  const days = usable.map((p) => p.day);
  const linePoints = usable.map((p, i) => ({
    x: xAt(i, usable.length),
    y: yAt(p.minPercent, min, max),
  }));
  const baselineY = yAt(90, min, max);

  return `${svgOpen('chart-spo2')}
    ${renderYAxisLabels(min, max, '%')}
    <line x1="${PAD_LEFT}" y1="${baselineY}" x2="${CHART_W - PAD_RIGHT}" y2="${baselineY}" stroke="${COLOURS.spo2Baseline}" stroke-width="1" stroke-dasharray="3 3"/>
    <text x="${CHART_W - PAD_RIGHT}" y="${baselineY - 3}" text-anchor="end" font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">90% baseline</text>
    ${renderXAxisLabels(days)}
    <path d="${buildPath(linePoints)}" fill="none" stroke="${COLOURS.spo2}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${linePoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="${COLOURS.spo2}"/>`).join('')}
  </svg>`;
}

// ── Sleep stacked bars (deep / light per night) ────────────────────

export function renderSleepStackedBars(
  points: ReadonlyArray<SleepDayPoint>,
): string {
  const usable = points.filter((p) => p.totalMinutes > 0);
  if (usable.length === 0) return emptyChart('No nights recorded yet.');

  const max = Math.max(...usable.map((p) => p.totalMinutes), 540); // anchor at 9h
  const days = usable.map((p) => p.day);
  const barW = Math.max(4, Math.min(18, PLOT_W / (usable.length * 1.6)));

  const bars = usable
    .map((p, i) => {
      const cx = xAt(i, usable.length);
      const x = cx - barW / 2;
      const deepH = (p.deepMinutes / max) * PLOT_H;
      const lightH = ((p.totalMinutes - p.deepMinutes) / max) * PLOT_H;
      const yLight = PAD_TOP + PLOT_H - lightH;
      const yDeep = PAD_TOP + PLOT_H - lightH - deepH;
      return `
        <rect x="${x}" y="${yLight}" width="${barW}" height="${lightH}" fill="${COLOURS.sleepLight}" rx="1.5"/>
        <rect x="${x}" y="${yDeep}" width="${barW}" height="${deepH}" fill="${COLOURS.sleepDeep}" rx="1.5"/>
      `;
    })
    .join('');

  // Y-axis labels in hours.
  const minLabel = '0h';
  const maxLabel = `${Math.round(max / 60)}h`;
  const yAxis =
    `<text x="${PAD_LEFT - 6}" y="${PAD_TOP + 4}" text-anchor="end" font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">${maxLabel}</text>` +
    `<text x="${PAD_LEFT - 6}" y="${CHART_H - PAD_BOTTOM}" text-anchor="end" font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">${minLabel}</text>`;

  return `${svgOpen('chart-sleep')}
    ${yAxis}
    ${renderXAxisLabels(days)}
    ${bars}
    <g font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">
      <rect x="${CHART_W - PAD_RIGHT - 80}" y="${PAD_TOP - 2}" width="80" height="14" fill="rgba(251,248,243,0.85)" rx="2"/>
      <rect x="${CHART_W - PAD_RIGHT - 70}" y="${PAD_TOP + 2}" width="7" height="7" fill="${COLOURS.sleepDeep}"/>
      <text x="${CHART_W - PAD_RIGHT - 60}" y="${PAD_TOP + 8}">Deep</text>
      <rect x="${CHART_W - PAD_RIGHT - 35}" y="${PAD_TOP + 2}" width="7" height="7" fill="${COLOURS.sleepLight}"/>
      <text x="${CHART_W - PAD_RIGHT - 25}" y="${PAD_TOP + 8}">Light</text>
    </g>
  </svg>`;
}

// ── Activity bars + target line ────────────────────────────────────

export function renderActivityBars(
  points: ReadonlyArray<ActivityDayPoint>,
  target = 6000,
): string {
  const usable = points.filter((p) => p.totalSteps >= 0);
  if (usable.length === 0) return emptyChart('No activity recorded yet.');

  const max = Math.max(target * 1.2, ...usable.map((p) => p.totalSteps));
  const days = usable.map((p) => p.day);
  const barW = Math.max(4, Math.min(18, PLOT_W / (usable.length * 1.6)));

  const bars = usable
    .map((p, i) => {
      const cx = xAt(i, usable.length);
      const x = cx - barW / 2;
      const h = (p.totalSteps / max) * PLOT_H;
      const y = PAD_TOP + PLOT_H - h;
      const reached = p.totalSteps >= target;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${reached ? COLOURS.activity : '#B8C9BC'}" rx="1.5"/>`;
    })
    .join('');

  const targetY = PAD_TOP + PLOT_H - (target / max) * PLOT_H;

  const minLabel = '0';
  const maxLabel = max >= 1000 ? `${(max / 1000).toFixed(1)}k` : `${Math.round(max)}`;
  const yAxis =
    `<text x="${PAD_LEFT - 6}" y="${PAD_TOP + 4}" text-anchor="end" font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">${maxLabel}</text>` +
    `<text x="${PAD_LEFT - 6}" y="${CHART_H - PAD_BOTTOM}" text-anchor="end" font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">${minLabel}</text>`;

  return `${svgOpen('chart-activity')}
    ${yAxis}
    ${renderXAxisLabels(days)}
    ${bars}
    <line x1="${PAD_LEFT}" y1="${targetY}" x2="${CHART_W - PAD_RIGHT}" y2="${targetY}" stroke="${COLOURS.activity}" stroke-width="1" stroke-dasharray="3 3" stroke-opacity="0.6"/>
    <text x="${CHART_W - PAD_RIGHT}" y="${targetY - 3}" text-anchor="end" font-family="Inter, sans-serif" font-size="9" fill="${COLOURS.axisLabel}">${target.toLocaleString()} target</text>
  </svg>`;
}

// ── BP distribution horizontal stacked bar ─────────────────────────

const DIST_SEGMENTS: Array<{
  key: keyof BPClassDistribution;
  label: string;
  colour: string;
}> = [
  { key: 'normal', label: 'Normal', colour: '#7BA88F' },
  { key: 'elevated', label: 'Elevated', colour: '#D9C68A' },
  { key: 'stage1', label: 'Stage 1', colour: '#E8A063' },
  { key: 'stage2', label: 'Stage 2', colour: '#C96442' },
  { key: 'crisis', label: 'Crisis', colour: '#7C2A1A' },
];

export function renderBpDistributionBar(
  distribution: BPClassDistribution,
): string {
  const total =
    distribution.normal +
    distribution.elevated +
    distribution.stage1 +
    distribution.stage2 +
    distribution.crisis;
  if (total === 0) {
    return `<p class="muted">No readings to classify.</p>`;
  }
  const barW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const barH = 18;
  const barY = 0;

  let cursor = PAD_LEFT;
  const segments = DIST_SEGMENTS.map((seg) => {
    const count = distribution[seg.key];
    if (count === 0) return '';
    const width = (count / total) * barW;
    const rect = `<rect x="${cursor.toFixed(1)}" y="${barY}" width="${width.toFixed(1)}" height="${barH}" fill="${seg.colour}"/>`;
    cursor += width;
    return rect;
  }).join('');

  const legend = DIST_SEGMENTS.filter((seg) => distribution[seg.key] > 0)
    .map(
      (seg) => `
      <div class="dist-legend-item">
        <span class="dist-swatch" style="background:${seg.colour}"></span>
        <span class="dist-legend-label">${seg.label}</span>
        <span class="dist-legend-count">${distribution[seg.key]}</span>
      </div>
    `,
    )
    .join('');

  return `
    <div class="dist-bar-wrap">
      <svg viewBox="0 0 ${CHART_W} ${barH + 4}" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" class="dist-bar">
        ${segments}
      </svg>
      <div class="dist-legend">${legend}</div>
    </div>
  `;
}

export const _internal = { COLOURS, CHART_W, CHART_H };

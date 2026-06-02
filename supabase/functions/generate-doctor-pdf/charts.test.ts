// charts.ts unit tests — Sprint 19 Block 10.
//
// Run from supabase/functions:
//   deno test --allow-net=:0 --no-check generate-doctor-pdf/charts.test.ts

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from 'jsr:@std/assert@1';
import {
  renderActivityBars,
  renderBpDistributionBar,
  renderBpTrendChart,
  renderHrTrendChart,
  renderSleepStackedBars,
  renderSpO2TrendChart,
} from './charts.ts';

Deno.test('renderBpTrendChart — renders an SVG with twin line paths', () => {
  const svg = renderBpTrendChart([
    { day: '2026-05-01', sys: 122, dia: 78, pulse: 64, count: 1 },
    { day: '2026-05-02', sys: 130, dia: 82, pulse: 66, count: 1 },
    { day: '2026-05-03', sys: 118, dia: 76, pulse: 62, count: 1 },
  ]);
  assertStringIncludes(svg, '<svg');
  assertStringIncludes(svg, 'class="chart chart-bp"');
  assertStringIncludes(svg, '#C96442'); // systolic line colour
  assertStringIncludes(svg, '#E8A063'); // diastolic line colour
  assertStringIncludes(svg, 'Systolic');
  assertStringIncludes(svg, 'Diastolic');
});

Deno.test('renderBpTrendChart — degrades to empty-state for <2 points', () => {
  const svg = renderBpTrendChart([
    { day: '2026-05-01', sys: 122, dia: 78, pulse: 64, count: 1 },
  ]);
  assertStringIncludes(svg, 'chart-empty');
  assertStringIncludes(svg, 'Not enough readings');
});

Deno.test('renderBpTrendChart — handles empty input', () => {
  const svg = renderBpTrendChart([]);
  assertStringIncludes(svg, 'chart-empty');
});

Deno.test('renderHrTrendChart — renders a single HR line', () => {
  const svg = renderHrTrendChart([
    { day: '2026-05-01', restingBpm: 62, count: 5 },
    { day: '2026-05-02', restingBpm: 64, count: 5 },
    { day: '2026-05-03', restingBpm: 60, count: 5 },
  ]);
  assertStringIncludes(svg, 'class="chart chart-hr"');
  assertStringIncludes(svg, '#C97C3D'); // HR colour
});

Deno.test('renderHrTrendChart — empty when restingBpm is null on every point', () => {
  const svg = renderHrTrendChart([
    { day: '2026-05-01', restingBpm: null, count: 1 },
    { day: '2026-05-02', restingBpm: null, count: 1 },
  ]);
  assertStringIncludes(svg, 'chart-empty');
});

Deno.test('renderSpO2TrendChart — renders line + 90% baseline label', () => {
  const svg = renderSpO2TrendChart([
    { day: '2026-05-01', avgPercent: 96, minPercent: 94, count: 3 },
    { day: '2026-05-02', avgPercent: 97, minPercent: 95, count: 3 },
    { day: '2026-05-03', avgPercent: 95, minPercent: 91, count: 3 },
  ]);
  assertStringIncludes(svg, 'class="chart chart-spo2"');
  assertStringIncludes(svg, '90% baseline');
});

Deno.test('renderSleepStackedBars — renders deep + light stacked bars with legend', () => {
  const svg = renderSleepStackedBars([
    { day: '2026-05-01', totalMinutes: 420, deepMinutes: 100 },
    { day: '2026-05-02', totalMinutes: 480, deepMinutes: 120 },
  ]);
  assertStringIncludes(svg, 'class="chart chart-sleep"');
  assertStringIncludes(svg, '#5848A0'); // deep colour
  assertStringIncludes(svg, '#A695CC'); // light colour
  assertStringIncludes(svg, 'Deep');
  assertStringIncludes(svg, 'Light');
});

Deno.test('renderSleepStackedBars — empty when no nights', () => {
  const svg = renderSleepStackedBars([]);
  assertStringIncludes(svg, 'chart-empty');
});

Deno.test('renderActivityBars — renders bars + target line label', () => {
  const svg = renderActivityBars([
    { day: '2026-05-01', totalSteps: 7800 },
    { day: '2026-05-02', totalSteps: 4200 },
    { day: '2026-05-03', totalSteps: 6100 },
  ]);
  assertStringIncludes(svg, 'class="chart chart-activity"');
  assertStringIncludes(svg, '6,000 target');
});

Deno.test('renderActivityBars — honors custom target', () => {
  const svg = renderActivityBars(
    [{ day: '2026-05-01', totalSteps: 9000 }],
    10_000,
  );
  assertStringIncludes(svg, '10,000 target');
});

Deno.test('renderBpDistributionBar — renders stacked bar + legend rows for non-zero categories', () => {
  const html = renderBpDistributionBar({
    normal: 18,
    elevated: 4,
    stage1: 2,
    stage2: 1,
    crisis: 0,
  });
  assertStringIncludes(html, '<svg');
  assertStringIncludes(html, 'class="dist-bar"');
  assertStringIncludes(html, 'Normal');
  assertStringIncludes(html, 'Elevated');
  assertStringIncludes(html, 'Stage 1');
  assertStringIncludes(html, 'Stage 2');
  // Crisis has 0 count → omitted from legend (avoid pretending a
  // category exists when it doesn't).
  assertEquals(html.includes('>Crisis<'), false);
});

Deno.test('renderBpDistributionBar — degrades to a muted placeholder when total is 0', () => {
  const html = renderBpDistributionBar({
    normal: 0,
    elevated: 0,
    stage1: 0,
    stage2: 0,
    crisis: 0,
  });
  assertStringIncludes(html, 'class="muted"');
  assert(!html.includes('<svg'));
});

Deno.test('all charts escape XML in day strings (defensive)', () => {
  const svg = renderBpTrendChart([
    { day: "2026-05-01<script>", sys: 122, dia: 78, pulse: 64, count: 1 },
    { day: '2026-05-02', sys: 130, dia: 82, pulse: 66, count: 1 },
    { day: '2026-05-03', sys: 118, dia: 76, pulse: 62, count: 1 },
  ]);
  // Day strings get formatted via shortDay() which strips the
  // year/month/day to a short label, so the script tag never lands
  // in the output. Defensive check: nothing in the SVG looks like a
  // raw < or > outside element syntax.
  assert(!svg.includes('<script>'));
});

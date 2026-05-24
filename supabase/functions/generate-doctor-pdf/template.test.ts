// generate-doctor-pdf — Sprint 9 template tests.
//
// Run from supabase/functions: `deno test --allow-net=:0 generate-doctor-pdf/`
//
// The template is a pure function over the ReportData shape, so these
// tests assert structure + voice without booting the rasterizer or
// hitting Supabase. The end-to-end path (auth → fetch → render →
// rasterize → upload) is exercised manually via curl + a local
// browserless container during integration verification.

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from 'jsr:@std/assert@1';
import { renderReport } from './template.ts';
import type { ReportData } from './types.ts';

function fixture(overrides: Partial<ReportData> = {}): ReportData {
  const base: ReportData = {
    user: {
      displayName: 'Mum',
      yearOfBirth: 1958,
      accountType: 'caregiver',
    },
    range: '30d',
    rangeLabel: 'Past 30 days',
    generatedAtIso: '2026-05-08T12:00:00Z',
    executiveSummary: {
      bpHeadline: '124/80 mmHg avg · 12% Stage 1+',
      hrHeadline: 'Resting 64 bpm · range 56–88',
      spo2Headline: 'Avg overnight low 94% · nadir 92%',
      sleepHeadline: '7h 00m avg · 28 nights',
      activityHeadline: '6.8k steps/day · 18/28 at target',
      keyFindings: [
        'BP within target band on most days.',
      ],
    },
    bp: {
      avgSys: 124,
      avgDia: 80,
      pctInRange: 0.86,
      avgPulsePressure: 44,
      pctStage1Plus: 0.12,
      pctStage2Plus: 0.04,
      points: [
        { day: '2026-04-08', sys: 122, dia: 79, pulse: 70, count: 1 },
      ],
      distribution: { normal: 18, elevated: 4, stage1: 2, stage2: 1, crisis: 0 },
      topAbnormal: [
        {
          day: '2026-04-12',
          sys: 144,
          dia: 92,
          pulse: 78,
          classification: 'stage2',
          flags: [],
        },
        {
          day: '2026-04-22',
          sys: 138,
          dia: 88,
          pulse: 76,
          classification: 'stage1',
          flags: [],
        },
      ],
      count: 25,
      sufficiency: { level: 'sufficient', label: '25 readings over 24 days.' },
      clinicalContext: {
        paragraphs: ['Average 124/80 mmHg across 25 readings over 24 days.'],
      },
    },
    hr: {
      avgResting: 64,
      minObserved: 56,
      maxObserved: 88,
      points: [{ day: '2026-04-08', restingBpm: 64, count: 5 }],
      count: 120,
      sufficiency: { level: 'sufficient', label: '120 samples over 28 days.' },
      clinicalContext: {
        paragraphs: ['Resting heart rate averaged 64 bpm across 120 samples over 28 days. Observed range 56–88 bpm.'],
      },
    },
    spo2: {
      avgMinPercent: 94,
      minObserved: 92,
      daysBelow90: 0,
      eventsBelow93: 1,
      points: [
        { day: '2026-04-08', avgPercent: 96, minPercent: 94, count: 3 },
      ],
      count: 90,
      sufficiency: { level: 'sufficient', label: '28 days observed.' },
      clinicalContext: {
        paragraphs: ['Average overnight low 94% across 28 days. Single lowest observation 92%.'],
      },
    },
    sleep: {
      avgTotalMinutes: 420,
      points: [{ day: '2026-04-08', totalMinutes: 420, deepMinutes: 100 }],
      count: 28,
      sufficiency: { level: 'sufficient', label: '28 nights observed.' },
      clinicalContext: {
        paragraphs: ['Average total sleep 7h 00m across 28 nights. Deep sleep averaged 100m (24% of total).'],
      },
    },
    activity: {
      avgSteps: 6800,
      daysAtTarget: 18,
      points: [{ day: '2026-04-08', totalSteps: 6800 }],
      count: 28,
      sufficiency: { level: 'sufficient', label: '28 days observed.' },
      clinicalContext: {
        paragraphs: ['Averaged 6.8k steps/day across 28 days. Reached the 6,000-step reference on 18 of 28 days.'],
      },
    },
    correlations: [
      {
        correlation_type: 'sleep_x_morning_bp',
        pearson_r: -0.86,
        effect_size: -0.083,
        effect_unit: 'mmHg/hour-sleep',
        sample_n: 24,
        is_meaningful: true,
        narrative_long:
          'On nights you slept under 6 hours, your morning systolic averaged about 5 points higher than on full-rest nights. Pattern based on the last 24 nights.',
      },
    ],
    notes: [
      { day: '2026-04-12', body: 'Felt anxious before reading.' },
    ],
  };
  return { ...base, ...overrides };
}

Deno.test('renderReport — emits all 7 sections per D13 §10.2', () => {
  const html = renderReport(fixture());
  for (const id of [
    'report-cover',
    'report-bp',
    'report-hr',
    'report-spo2',
    'report-sleep',
    'report-activity',
    'report-cross-vital',
    'report-notes',
  ]) {
    assertStringIncludes(html, `id="${id}"`);
  }
});

Deno.test('renderReport — caregiver cover line uses "their doctor"', () => {
  const html = renderReport(
    fixture({
      user: { displayName: 'Mum', yearOfBirth: 1958, accountType: 'caregiver' },
    }),
  );
  assertStringIncludes(
    html,
    "This report is general information from Mum&#39;s Leiko watch. It is not a diagnosis. Please discuss with their doctor.",
  );
});

Deno.test('renderReport — self_buyer cover line uses "your doctor"', () => {
  const html = renderReport(
    fixture({
      user: {
        displayName: 'Adaeze',
        yearOfBirth: 1985,
        accountType: 'self_buyer',
      },
    }),
  );
  assertStringIncludes(
    html,
    'This report is general information from your Leiko watch. It is not a diagnosis. Please discuss with your doctor.',
  );
});

Deno.test('renderReport — never uses forbidden vocabulary', () => {
  const html = renderReport(fixture()).toLowerCase();
  // CLAUDE.md forbidden list (excluding the explicit "not a diagnosis"
  // disclaimer, which uses the negation safely).
  for (const banned of [
    'patient',
    'diagnose',
    'treat',
    'cure',
    'predict',
    'prevent',
    'silent killer',
    'ticking time bomb',
    'dangerous level',
    'critical level',
    'medical advice',
  ]) {
    assert(
      !html.includes(banned),
      `forbidden vocabulary "${banned}" appeared in PDF`,
    );
  }
  // "diagnosis" appears only inside the negation phrase. Verify by
  // counting — should appear EXACTLY once.
  const matches = html.match(/diagnosis/g) ?? [];
  assertEquals(matches.length, 1);
});

Deno.test('renderReport — BP section includes classification distribution + abnormal table', () => {
  const html = renderReport(fixture());
  assertStringIncludes(html, 'Classification distribution');
  assertStringIncludes(html, 'Most abnormal readings');
  assertStringIncludes(html, '<td>Stage 2</td>');
  assertStringIncludes(html, '<td>144/92</td>');
});

Deno.test('renderReport — cross-vital section uses meaningful narratives', () => {
  const html = renderReport(fixture());
  assertStringIncludes(html, 'Sleep · Blood pressure');
  assertStringIncludes(html, 'On nights you slept under 6 hours');
});

// ─── Sprint 19 PDF v2 — clinical-depth pass ──────────────────────────

Deno.test('renderReport — Executive Summary renders all five vital headlines on the cover', () => {
  const html = renderReport(fixture());
  assertStringIncludes(html, 'At a glance');
  assertStringIncludes(html, '124/80 mmHg avg');
  assertStringIncludes(html, 'Resting 64 bpm');
  assertStringIncludes(html, 'Avg overnight low 94%');
  assertStringIncludes(html, '7h 00m avg');
  assertStringIncludes(html, '6.8k steps/day');
});

Deno.test('renderReport — clinical-context paragraphs render under each section header', () => {
  const html = renderReport(fixture());
  assertStringIncludes(html, 'Average 124/80 mmHg across 25 readings');
  assertStringIncludes(html, 'Resting heart rate averaged 64 bpm');
  assertStringIncludes(html, 'Single lowest observation 92%');
});

Deno.test('renderReport — reference footnotes appear under every populated section', () => {
  const html = renderReport(fixture());
  assertStringIncludes(html, 'Reference: ACC/AHA 2017 categories');
  assertStringIncludes(html, 'AHA adult resting heart rate 60');
  assertStringIncludes(html, 'SpO2 ≥95% typical');
  assertStringIncludes(html, 'NSF adult sleep 7');
  assertStringIncludes(html, '6,000 steps/day');
});

Deno.test('renderReport — running page header repeats on every section page 2+', () => {
  const html = renderReport(fixture());
  // Cover has no running header; sections 2+ do. Count occurrences.
  const occurrences = (html.match(/class="page-header"/g) ?? []).length;
  // 7 sections after the cover.
  assertEquals(occurrences, 7);
});

Deno.test('renderReport — insufficient-data state replaces averages/charts for sparse vitals', () => {
  const html = renderReport(
    fixture({
      sleep: {
        avgTotalMinutes: 425,
        points: [{ day: '2026-04-08', totalMinutes: 425, deepMinutes: 90 }],
        count: 1,
        sufficiency: { level: 'insufficient', label: '1 of ≥3 nights needed.' },
        clinicalContext: {
          paragraphs: ['1 night of data — not enough to characterise a pattern.'],
        },
      },
    }),
  );
  assertStringIncludes(html, 'Not enough data over this range to characterise a pattern.');
  assertStringIncludes(html, '1 of ≥3 nights needed.');
  // The misleading "Average total · 7h 05m" tile must NOT render.
  const tileMatches = html.match(/Average total/g);
  assertEquals(tileMatches, null);
});

Deno.test('renderReport — flag chips render on BP abnormal table when present', () => {
  const html = renderReport(
    fixture({
      bp: {
        avgSys: 142,
        avgDia: 88,
        pctInRange: 0.2,
        avgPulsePressure: 54,
        pctStage1Plus: 0.9,
        pctStage2Plus: 0.7,
        points: [{ day: '2026-04-08', sys: 142, dia: 88, pulse: 54, count: 1 }],
        distribution: { normal: 1, elevated: 0, stage1: 2, stage2: 7, crisis: 0 },
        topAbnormal: [
          {
            day: '2026-04-22',
            sys: 142,
            dia: 80,
            pulse: 54,
            classification: 'stage2',
            flags: [
              { reason: 'bradycardia', label: 'Bradycardia · 54 bpm' },
              { reason: 'elevated_pp', label: 'Wide PP · 62' },
            ],
          },
        ],
        count: 10,
        sufficiency: { level: 'sufficient', label: '10 readings over 7 days.' },
        clinicalContext: { paragraphs: ['Average 142/88 mmHg.'] },
      },
    }),
  );
  assertStringIncludes(html, 'class="flag-chip flag-bradycardia"');
  assertStringIncludes(html, 'Bradycardia · 54 bpm');
  assertStringIncludes(html, 'Wide PP · 62');
});

Deno.test('renderReport — clinical-context fields render on cover when provided', () => {
  const html = renderReport(
    fixture({
      clinicalFields: {
        medications: 'lisinopril 10mg daily',
        symptoms: 'occasional morning dizziness',
        targetBp: '<130/80',
      },
    }),
  );
  assertStringIncludes(html, 'Clinical context');
  assertStringIncludes(html, 'lisinopril 10mg daily');
  assertStringIncludes(html, 'occasional morning dizziness');
  assertStringIncludes(html, '&lt;130/80');
});

Deno.test('renderReport — clinical-context fields block absent when none supplied', () => {
  const html = renderReport(fixture());
  // Eyebrow string only appears when block renders.
  const matches = html.match(/class="clinical-eyebrow"/g);
  assertEquals(matches, null);
});

Deno.test('renderReport — empty cross-vital section uses voice-passing fallback', () => {
  const html = renderReport(fixture({ correlations: [] }));
  // Sprint 19 PDF v2 — copy now explains data sufficiency rather
  // than just saying "no patterns", so the clinician knows whether
  // to expect richer output from a longer-range report.
  assertStringIncludes(
    html,
    'No cross-vital correlations reached the meaningful threshold yet.',
  );
});

Deno.test('renderReport — empty sleep section degrades gracefully', () => {
  const html = renderReport(
    fixture({
      sleep: {
        avgTotalMinutes: null,
        points: [],
        count: 0,
        sufficiency: { level: 'none', label: 'No sleep sessions recorded in this range.' },
        clinicalContext: { paragraphs: [] },
      },
    }),
  );
  assertStringIncludes(html, 'No sleep sessions recorded over the period.');
});

// ─── Sprint 18 / FUN-5 — AI sections + coverNote ───────────────────────

Deno.test('renderReport — cover-page note renders when provided', () => {
  const html = renderReport(
    fixture({
      coverNote:
        'BP often spikes on Mondays after the weekend visit to the village.',
    }),
  );
  assertStringIncludes(html, 'class="cover-note"');
  assertStringIncludes(html, 'BP often spikes on Mondays');
});

Deno.test('renderReport — cover-page note absent when omitted', () => {
  const html = renderReport(fixture());
  assert(!html.includes('class="cover-note"'));
});

Deno.test('renderReport — cover-page note absent when whitespace-only', () => {
  const html = renderReport(fixture({ coverNote: '   ' }));
  assert(!html.includes('class="cover-note"'));
});

Deno.test('renderReport — AI cover paragraph renders when provided', () => {
  const html = renderReport(
    fixture({
      aiSections: {
        cover:
          'Average systolic over the past 30 days was 124 mmHg with 86% in-range readings; one stage-2 event flagged on April 12.',
        observations: null,
      },
    }),
  );
  assertStringIncludes(html, 'class="cover-ai"');
  assertStringIncludes(html, 'Average systolic over the past 30 days');
});

Deno.test('renderReport — AI cover absent when aiSections.cover is null', () => {
  const html = renderReport(
    fixture({ aiSections: { cover: null, observations: 'obs' } }),
  );
  assert(!html.includes('class="cover-ai"'));
});

Deno.test('renderReport — AI observations render above correlation cards', () => {
  const html = renderReport(
    fixture({
      aiSections: {
        cover: null,
        observations:
          'Sleep duration and morning BP trended inversely across the window.',
      },
    }),
  );
  assertStringIncludes(html, 'class="cross-vital-ai"');
  // AI paragraph appears before the correlation card body.
  const aiIdx = html.indexOf('cross-vital-ai');
  const cardIdx = html.indexOf('correlation-card');
  assert(aiIdx > -1 && cardIdx > -1 && aiIdx < cardIdx);
});

Deno.test('renderReport — AI observations render alone when no correlations exist', () => {
  const html = renderReport(
    fixture({
      correlations: [],
      aiSections: {
        cover: null,
        observations: 'Sparse data this period; trends are tentative.',
      },
    }),
  );
  assertStringIncludes(html, 'Sparse data this period');
  // Fallback "no patterns reached the threshold" line is suppressed
  // when the AI paragraph carries the section.
  assert(
    !html.includes(
      'No cross-vital patterns reached the meaningful threshold',
    ),
  );
});

Deno.test('renderReport — AI observations split on double-newline into multiple paragraphs', () => {
  const html = renderReport(
    fixture({
      aiSections: {
        cover: null,
        observations: 'First paragraph here.\n\nSecond paragraph here.',
      },
    }),
  );
  const matches = html.match(/class="cross-vital-ai"/g) ?? [];
  assertEquals(matches.length, 2);
});

Deno.test('renderReport — disclaimer renders even when AI cover is present', () => {
  const html = renderReport(
    fixture({
      aiSections: {
        cover: 'AI cover here.',
        observations: null,
      },
    }),
  );
  // Both the AI paragraph and the regulatory disclaimer must coexist.
  assertStringIncludes(html, 'AI cover here.');
  assertStringIncludes(html, 'It is not a diagnosis');
});

Deno.test('renderReport — notes section lists user-supplied notes', () => {
  const html = renderReport(fixture());
  assertStringIncludes(html, 'Felt anxious before reading.');
  assertStringIncludes(html, '2026-04-12');
});

Deno.test('renderReport — empty notes section uses voice-passing fallback', () => {
  const html = renderReport(fixture({ notes: [] }));
  assertStringIncludes(html, 'No notes attached to readings in this range.');
});

Deno.test('renderReport — fragment mode skips the doctype + html wrapper', () => {
  const html = renderReport(fixture(), { fragment: true });
  assert(!html.includes('<!DOCTYPE html>'));
  assert(!html.includes('<html'));
  assert(html.startsWith('<section id="report-cover"'));
});

Deno.test('renderReport — escapes HTML in user-provided strings', () => {
  const html = renderReport(
    fixture({
      user: {
        displayName: '<script>alert(1)</script>',
        yearOfBirth: null,
        accountType: 'self_buyer',
      },
      notes: [{ day: '2026-04-12', body: '<img onerror="x">' }],
    }),
  );
  assert(!html.includes('<script>alert(1)</script>'));
  assertStringIncludes(html, '&lt;script&gt;');
  assertStringIncludes(html, '&lt;img onerror=');
});

// voiceLint.test.ts — Sprint 13 task 2 unit coverage.
//
// Covers: every forbidden-vocabulary entry triggers, clean copy
// passes, frontmatter / code / MDX-component stripping is correct,
// soft vs hard separation, word-boundary safety (patience !=
// patient), line reporting against the ORIGINAL input.
//
// Runs in the "pure" Jest project (Node, ts-jest).

import { lintVoiceText, formatVoiceHits } from '../voiceLint';

describe('lintVoiceText — hard-fail vocabulary', () => {
  // For each canonical hard fail we expect at least one hit when the
  // word appears in body copy.
  const HARD_FAIL_SAMPLES: Array<{ label: string; input: string }> = [
    { label: 'patient', input: 'A reading from a patient.' },
    { label: 'patients', input: 'Some patients see lower numbers.' },
    { label: 'diagnose', input: 'The watch will diagnose your condition.' },
    { label: 'diagnosis', input: 'Awaiting a diagnosis.' },
    { label: 'diagnostic', input: 'A diagnostic threshold.' },
    { label: 'treat', input: 'We will treat this finding.' },
    { label: 'treatment', input: 'Begin treatment immediately.' },
    { label: 'cure', input: 'A cure for hypertension.' },
    { label: 'predict', input: 'The watch can predict your stroke risk.' },
    { label: 'prevent', input: 'This will prevent disease.' },
    { label: 'medical-grade', input: 'Medical-grade SpO2 sensor.' },
    { label: 'clinical-grade', input: 'A clinical-grade reading.' },
    {
      label: 'continuous BP monitoring',
      input: 'Get continuous blood pressure monitoring.',
    },
    { label: 'replaces your doctor', input: 'Leiko replaces your doctor.' },
    { label: 'you may have', input: 'You may have hypertension.' },
    { label: 'we detected', input: 'We detected an irregular pattern.' },
    { label: 'you are at risk', input: 'You are at risk of stroke.' },
    { label: 'TCM diagnosis', input: 'Includes a TCM diagnosis feature.' },
    { label: 'silent killer', input: 'Hypertension is a silent killer.' },
    { label: 'ticking time bomb', input: 'A ticking time bomb in your chest.' },
    { label: 'before its too late', input: 'Act before its too late.' },
    {
      label: 'before it\'s too late',
      input: "Act before it's too late.",
    },
    { label: 'medical advice', input: 'This is not medical advice.' },
    { label: 'dangerous level', input: 'Reached a dangerous level.' },
    { label: 'critical level', input: 'Numbers at a critical level.' },
    {
      label: 'take control of your hypertension',
      input: 'Take control of your hypertension today.',
    },
    { label: "don't wait", input: "Don't wait — sign up now." },
    { label: 'start today', input: 'Start today and see results.' },
    {
      label: 'you owe it to yourself',
      input: 'You owe it to yourself to act.',
    },
    { label: 'biohack', input: 'Biohack your sleep.' },
    { label: 'optimise', input: 'Optimise your performance.' },
    { label: 'optimize', input: 'Optimize your routine.' },
    { label: 'streak', input: 'Keep your streak going.' },
    { label: 'level up', input: 'Time to level up your habits.' },
    { label: 'achievement unlocked', input: 'Achievement unlocked.' },
    { label: 'crush', input: 'Crush your goals.' },
    { label: 'smash', input: 'Smash through plateaus.' },
    { label: 'smart alerts', input: 'Get smart alerts on your phone.' },
    { label: 'you should', input: 'You should reduce salt.' },
    { label: 'you must', input: 'You must take this seriously.' },
    { label: 'loved ones', input: 'Care for your loved ones.' },
    {
      label: 'will lower your BP',
      input: 'A walk will lower your BP.',
    },
    {
      label: 'will help you live longer',
      input: 'Daily steps will help you live longer.',
    },
    {
      label: 'multiple bangs',
      input: 'Sync done!! Looking good.',
    },
  ];

  for (const sample of HARD_FAIL_SAMPLES) {
    it(`flags HARD: ${sample.label}`, () => {
      const result = lintVoiceText(sample.input);
      const hardHit = result.hardHits[0];
      expect(result.passes).toBe(false);
      expect(hardHit).toBeDefined();
      expect(hardHit.severity).toBe('hard');
    });
  }
});

describe('lintVoiceText — clean copy passes', () => {
  const CLEAN: string[] = [
    "Most adults sit between 60 and 100 beats per minute.",
    "A short walk after dinner is one of the most studied patterns.",
    "Talk to your doctor about what is right for you.",
    "Mum is in pattern. 124/79 this morning, six below her week.",
    "The reading is a snapshot. One reading does not define you.",
    "People who add consistent moderate movement often see their resting numbers settle into a lower range over weeks.",
  ];
  for (const s of CLEAN) {
    it(`passes: "${s.slice(0, 60)}…"`, () => {
      const result = lintVoiceText(s);
      expect(result.passes).toBe(true);
      expect(result.hardHits).toHaveLength(0);
    });
  }
});

describe('lintVoiceText — word boundaries', () => {
  it('does NOT match "patience" when looking for "patient"', () => {
    const result = lintVoiceText('Patience is helpful here.');
    const hardHits = result.hardHits.filter(h =>
      /patient/i.test(h.pattern.source),
    );
    expect(hardHits).toHaveLength(0);
  });

  it('does NOT match "preventative" when looking for prevent (because we DO match preventative — but a single literal "events" should not)', () => {
    // "events" should not match "prevent" — sanity
    const result = lintVoiceText('A series of events occurred.');
    const hardHits = result.hardHits.filter(h =>
      /prevent/i.test(h.pattern.source),
    );
    expect(hardHits).toHaveLength(0);
  });

  it('does NOT match "predilection" when looking for predict', () => {
    const result = lintVoiceText('A predilection for early starts.');
    const hardHits = result.hardHits.filter(h =>
      /predict/i.test(h.pattern.source),
    );
    expect(hardHits).toHaveLength(0);
  });

  it('does NOT match "treats" inside "treaties" / "retreats"', () => {
    const result = lintVoiceText('She retreats to a quiet room.');
    const hardHits = result.hardHits.filter(h =>
      /treat/i.test(h.pattern.source),
    );
    expect(hardHits).toHaveLength(0);
  });

  it('does NOT match "cured" inside "obscured"', () => {
    const result = lintVoiceText('The trend was obscured by noise.');
    const hardHits = result.hardHits.filter(h =>
      /cure/i.test(h.pattern.source),
    );
    expect(hardHits).toHaveLength(0);
  });
});

describe('lintVoiceText — soft warnings', () => {
  it('flags "wellness" as soft, not hard', () => {
    const result = lintVoiceText('A wellness reference, not a clinical measurement.');
    expect(result.passes).toBe(true);
    expect(result.softHits.length).toBeGreaterThan(0);
    expect(
      result.softHits.some(h => /wellness/i.test(h.pattern.source)),
    ).toBe(true);
  });

  it('flags "performance" as soft', () => {
    const result = lintVoiceText('Daily performance review.');
    expect(result.passes).toBe(true);
    expect(
      result.softHits.some(h => /performance/i.test(h.pattern.source)),
    ).toBe(true);
  });

  it('flags "simple" as soft, not hard', () => {
    const result = lintVoiceText('A simple change to your routine.');
    expect(result.passes).toBe(true);
    expect(
      result.softHits.some(h => /simple/i.test(h.pattern.source)),
    ).toBe(true);
  });

  it('hard verb form "will reduce" is soft (context-rescue)', () => {
    const result = lintVoiceText('We will reduce noise in the trend chart.');
    expect(result.passes).toBe(true);
    expect(result.softHits.length).toBeGreaterThan(0);
  });
});

describe('lintVoiceText — strip behaviour', () => {
  it('strips YAML frontmatter so frontmatter words do not trigger', () => {
    const input = `---
title: Patient education on HR
sources:
  - "Treatment guidelines"
---

The reading is a snapshot.`;
    const result = lintVoiceText(input);
    // "Patient" + "Treatment" sit in frontmatter only — both should be ignored.
    expect(result.hardHits).toHaveLength(0);
    expect(result.passes).toBe(true);
  });

  it('strips fenced code blocks', () => {
    const input = `Some prose.
\`\`\`ts
// patient = anything
function diagnose() {}
\`\`\`
Calmer prose.`;
    const result = lintVoiceText(input);
    expect(result.hardHits).toHaveLength(0);
  });

  it('strips inline code', () => {
    const input = 'Set the `patient_id` column.';
    const result = lintVoiceText(input);
    expect(result.hardHits).toHaveLength(0);
  });

  it('strips <Source> blocks but keeps surrounding text', () => {
    const input =
      'Per evidence, the trend is gradual.\n<Source>AHA/ACC 2017 Hypertension Guideline (Whelton et al)</Source>';
    const result = lintVoiceText(input);
    expect(result.hardHits).toHaveLength(0);
  });

  it('strips <Reading /> self-closing tags', () => {
    const input = 'A reading like <Reading sys={124} dia={79} /> is two numbers.';
    const result = lintVoiceText(input);
    expect(result.hardHits).toHaveLength(0);
  });

  it('keeps <Definition> inner text under scrutiny', () => {
    const input =
      '<Definition term="systolic">a patient context for the term</Definition>';
    const result = lintVoiceText(input);
    // The inner text contains "patient" — should still trigger.
    expect(result.hardHits.length).toBeGreaterThan(0);
  });

  it('honours opt-out: stripFrontmatter false', () => {
    const input = `---
title: Patient guide
---
clean.`;
    const result = lintVoiceText(input, { stripFrontmatter: false });
    expect(result.hardHits.length).toBeGreaterThan(0);
  });
});

describe('lintVoiceText — line reporting', () => {
  it('reports line number from the original input', () => {
    const input = `line 1
line 2 has a patient here
line 3`;
    const result = lintVoiceText(input);
    const hit = result.hardHits[0];
    expect(hit).toBeDefined();
    expect(hit.line).toBe(2);
  });

  it('reports line from beyond frontmatter', () => {
    const input = `---
title: clean
---
line A
line B with treatment
line C`;
    const result = lintVoiceText(input);
    const hit = result.hardHits[0];
    expect(hit).toBeDefined();
    // Frontmatter ends after line 3; "treatment" is on line 5 of the
    // ORIGINAL input.
    expect(hit.line).toBe(5);
  });
});

describe('lintVoiceText — case insensitivity', () => {
  it('matches uppercase forbidden words', () => {
    const result = lintVoiceText('A Patient profile.');
    expect(result.hardHits.length).toBeGreaterThan(0);
  });

  it('matches mixed case', () => {
    const result = lintVoiceText('A DIAGNOSIS will be made.');
    expect(result.hardHits.length).toBeGreaterThan(0);
  });
});

describe('formatVoiceHits', () => {
  it('formats no-hit case', () => {
    expect(formatVoiceHits([])).toBe('(no voice-lint hits)');
  });

  it('formats hard + soft hits with severity tag', () => {
    const result = lintVoiceText(
      'A patient using a wellness reference.',
    );
    const formatted = formatVoiceHits(result.hits);
    expect(formatted).toContain('HARD');
    expect(formatted).toContain('soft');
    expect(formatted).toContain('"patient"');
    expect(formatted).toContain('"wellness"');
  });
});

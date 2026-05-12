// voice-lint-push — Sprint 15.
//
// Deno-compatible voice-rule scanner for push notification bodies.
// Mirrors apps/mobile/src/services/voice/voiceLint.ts but narrows the
// surface area to "scan a plain string, return hard hits". Notification
// strings are short and have no MDX so the strip helpers aren't needed.
//
// HARD RULE: send-push fails closed if a rendered notification body
// contains a hard hit. The PostHog event records the pattern + push
// is dropped. We never send fear language or claim-violating copy.
//
// Sourced from:
//   apps/mobile/src/services/voice/voiceLint.ts (Sprint 13 voice lint)
//   docs/05-voice-and-claims.md
//   docs/_reference/D11-brand-repositioning.md §3.2, §3.3

export type VoiceSeverity = 'hard' | 'soft';

export interface VoicePattern {
  pattern: RegExp;
  severity: VoiceSeverity;
  why: string;
  source?: string;
}

export interface VoiceHit {
  pattern: string;
  severity: VoiceSeverity;
  why: string;
  source?: string;
  match: string;
  index: number;
}

export interface VoiceLintResult {
  hits: VoiceHit[];
  hardHits: VoiceHit[];
  softHits: VoiceHit[];
  passes: boolean;
}

// Push-relevant subset of VOICE_PATTERNS. Keeps the formatting-failure
// regex (multi-bang shouting) and trims the MDX-specific Definition
// tag regex which can't appear in a 120-char push body.
export const PUSH_VOICE_PATTERNS: VoicePattern[] = [
  {
    pattern: /\bpatients?\b/i,
    severity: 'hard',
    why: 'Use "Mum"/"Dad"/"your parent"/"you" — never "patient"',
    source: 'docs/05-voice-and-claims.md HARD FAIL',
  },
  {
    pattern: /\bdiagnos(?:e[sd]?|is|es|ing|tic)\b/i,
    severity: 'hard',
    why: "Diagnosis is a doctor's job",
    source: 'docs/05 + D11 §3.2',
  },
  {
    pattern: /\btreat(?:s|ed|ing|ment|ments)?\b/i,
    severity: 'hard',
    why: 'Treatment is medical practice',
    source: 'docs/05 + D11 §3.2',
  },
  {
    pattern: /\bcure[sd]?\b/i,
    severity: 'hard',
    why: 'Never claim cure',
    source: 'docs/05',
  },
  {
    pattern: /\bpredict(?:s|ed|ing|ion|ions|ive)?\b/i,
    severity: 'hard',
    why: 'Outside cleared IFU when applied to disease',
    source: 'docs/05',
  },
  {
    pattern: /\bprevent(?:s|ed|ing|ion|ions|ative)?\b/i,
    severity: 'hard',
    why: 'Outside cleared IFU when applied to disease',
    source: 'docs/05',
  },
  {
    pattern: /silent killer/i,
    severity: 'hard',
    why: 'Fear language',
    source: 'D11 §3.2',
  },
  {
    pattern: /ticking time bomb/i,
    severity: 'hard',
    why: 'Fear language',
    source: 'D11 §3.2',
  },
  {
    pattern: /before it'?s too late/i,
    severity: 'hard',
    why: 'Fear language',
    source: 'D11 §3.2',
  },
  {
    pattern: /medical advice/i,
    severity: 'hard',
    why: 'Say "Talk to your doctor"',
    source: 'D11 §3.2',
  },
  {
    pattern: /(?:dangerous|critical) (?:level|levels|range|reading)s?/i,
    severity: 'hard',
    why: 'Use calm-concerned / confirmed-urgent phrasing',
    source: 'docs/05 HARD FAIL',
  },
  {
    pattern: /\balerts?\b/i,
    severity: 'hard',
    why: 'Use "notice" / "worth a look" — "alert" is escalating',
    source: 'docs/11-push-notifications.md §4',
  },
  {
    pattern: /\bwarnings?\b/i,
    severity: 'hard',
    why: 'Calm before clever — use the calm-concerned phrasing',
    source: 'docs/11-push-notifications.md §4',
  },
  {
    pattern: /\bcritical\b/i,
    severity: 'hard',
    why: 'Fear language',
    source: 'docs/05',
  },
  {
    pattern: /!{2,}/,
    severity: 'hard',
    why: 'Multiple ! is shouting',
    source: 'docs/05 HARD FAIL — formatting',
  },
  {
    pattern: /\bbiohacks?\b|\bbiohacking\b/i,
    severity: 'hard',
    why: 'Quantified-self bro vocabulary',
    source: 'D11 §3.3',
  },
  {
    pattern: /\boptimi[sz]e[sd]?\b|\boptimi[sz]ation\b|\boptimi[sz]ing\b/i,
    severity: 'hard',
    why: 'Quantified-self vocabulary',
    source: 'D11 §3.3',
  },
  {
    pattern: /\b(?:streaks?|level up|levelled up)\b/i,
    severity: 'hard',
    why: 'Gamification',
    source: 'D11 §3.3',
  },
  {
    pattern: /achievement unlocked/i,
    severity: 'hard',
    why: 'Gamification',
    source: 'D11 §3.3',
  },
  {
    pattern: /\b(?:crush|smash|destroy)(?:es|ed|ing)?\b/i,
    severity: 'hard',
    why: 'Fitness-bro vocabulary',
    source: 'D11 §3.3',
  },
  {
    pattern: /smart (?:alert|insight|reminder|notification|goal|feature|tracking)s?/i,
    severity: 'hard',
    why: '"Smart" applied to features is meaningless',
    source: 'D11 §3.3',
  },
  {
    pattern: /\bloved ones?\b/i,
    severity: 'hard',
    why: 'Be specific ("your mom", "your dad")',
    source: 'docs/05 HARD FAIL',
  },
  {
    pattern: /will lower your (?:bp|blood pressure)/i,
    severity: 'hard',
    why: 'Outcome promise',
    source: 'D11 §3.2',
  },
  {
    pattern: /will help you live longer/i,
    severity: 'hard',
    why: 'Outcome promise',
    source: 'D11 §3.2',
  },
];

export function lintPushText(input: string): VoiceLintResult {
  const hits: VoiceHit[] = [];
  for (const p of PUSH_VOICE_PATTERNS) {
    const flags = p.pattern.flags.includes('g')
      ? p.pattern.flags
      : p.pattern.flags + 'g';
    const re = new RegExp(p.pattern.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      hits.push({
        pattern: p.pattern.source,
        severity: p.severity,
        why: p.why,
        source: p.source,
        match: m[0],
        index: m.index,
      });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  const hardHits = hits.filter((h) => h.severity === 'hard');
  const softHits = hits.filter((h) => h.severity === 'soft');
  return { hits, hardHits, softHits, passes: hardHits.length === 0 };
}

/**
 * Per docs/11-push-notifications.md §4: body ≤ 120 chars on iOS,
 * ≤ 180 on Android. Use this as a guard before egress.
 */
export const PUSH_BODY_MAX_IOS = 120;
export const PUSH_BODY_MAX_ANDROID = 180;

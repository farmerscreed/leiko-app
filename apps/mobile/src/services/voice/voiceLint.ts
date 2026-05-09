// voiceLint — Sprint 13 task 2.
//
// Pure-function voice rule scanner. Source of truth for forbidden
// vocabulary is docs/05-voice-and-claims.md (HARD FAIL + SOFT WARNING
// tables) plus the augments in:
//
//   docs/_reference/D11-brand-repositioning.md §3.2 + §3.3
//   docs/08-learn-module.md §2.2
//   docs/_reference/D9-editorial.md §2.2 + §2.3
//
// First consumer: Learn article MDX bodies (Sprint 13).
// Future consumers: AI narration templates (Sprint 11), DEFER templates
// (Sprint 11), Tier-B prompt fixtures (Sprint 12), i18n strings, and
// Picks blurbs (D15).
//
// This module runs in the "pure" Jest project (Node, ts-jest, no RN).
// Keep it dependency-free.

export type VoiceSeverity = 'hard' | 'soft';

export interface VoicePattern {
  /** Regex to match. Word-boundaries enforced where appropriate. */
  pattern: RegExp;
  severity: VoiceSeverity;
  /** Why this is forbidden — surfaced in the lint output. */
  why: string;
  /** Optional source citation (which doc/section forbids it). */
  source?: string;
}

export interface VoiceHit {
  pattern: RegExp;
  severity: VoiceSeverity;
  why: string;
  source?: string;
  /** The matched substring. */
  match: string;
  /** Offset into the input text. */
  index: number;
  /** 1-based line number into the input text. */
  line: number;
}

export interface VoiceLintResult {
  hits: VoiceHit[];
  hardHits: VoiceHit[];
  softHits: VoiceHit[];
  passes: boolean;
}

export interface VoiceLintOptions {
  /**
   * Strip frontmatter delimited by `---` ... `---` at the start of the
   * input. Default true — useful for MDX article scanning.
   */
  stripFrontmatter?: boolean;
  /**
   * Strip MDX-style component blocks (`<Source>...</Source>`,
   * `<Definition>...</Definition>`, `<Reading ... />`). Default true.
   * The interior text of `<Definition>` IS scanned (it is user-visible
   * tooltip copy); only the tag wrapping is removed. `<Source>` and
   * `<Reading>` are stripped whole.
   */
  stripMdxComponents?: boolean;
  /**
   * Strip fenced code blocks ``` ... ```. Default true.
   */
  stripCodeBlocks?: boolean;
}

// -----------------------------------------------------------------
// The forbidden-vocabulary registry.
//
// Every entry cites its source doc + section so a future maintainer
// can trace why the rule exists. A new entry without a source is a
// PR-review red flag.
// -----------------------------------------------------------------

export const VOICE_PATTERNS: VoicePattern[] = [
  // --- Clinical-distancing language (docs/05 + D9 + Learn module) ----
  {
    pattern: /\bpatients?\b/i,
    severity: 'hard',
    why: 'Clinical, distancing — use "Mum"/"Dad"/"your parent"/"you"',
    source: 'docs/05-voice-and-claims.md HARD FAIL',
  },
  {
    pattern: /\bdiagnos(?:e[sd]?|is|es|ing|tic)\b/i,
    severity: 'hard',
    why: "Diagnosis is a doctor's job — describe data, never label it",
    source: 'docs/05-voice-and-claims.md + D11 §3.2',
  },
  {
    pattern: /\btreat(?:s|ed|ing|ment|ments)?\b/i,
    severity: 'hard',
    why: 'Treatment is medical practice — use "monitor"/"track"/"watch"',
    source: 'docs/05-voice-and-claims.md + D11 §3.2',
  },
  {
    pattern: /\bcure[sd]?\b/i,
    severity: 'hard',
    why: 'Treatment is medical practice — never claim cure',
    source: 'docs/05-voice-and-claims.md + D11 §3.2',
  },

  // --- FDA / IFU enforcement risk -----------------------------------
  {
    pattern: /\bpredict(?:s|ed|ing|ion|ions|ive)?\b/i,
    severity: 'hard',
    why: 'FDA enforcement risk — outside K141683 IFU when applied to disease',
    source: 'docs/05-voice-and-claims.md HARD FAIL',
  },
  {
    pattern: /\bprevent(?:s|ed|ing|ion|ions|ative|ative)?\b/i,
    severity: 'hard',
    why: 'FDA enforcement risk — outside K141683 IFU when applied to disease',
    source: 'docs/05-voice-and-claims.md HARD FAIL',
  },
  {
    pattern: /medical[- ]grade|clinical[- ]grade/i,
    severity: 'hard',
    why: 'SpO2 is wellness-only on this device — use "wellness reference"',
    source: 'docs/05-voice-and-claims.md + Learn module §2.2',
  },
  {
    pattern: /continuous (?:blood pressure|bp) monitoring/i,
    severity: 'hard',
    why: 'Misleading — BP is on-demand on this device, not continuous',
    source: 'docs/05-voice-and-claims.md HARD FAIL',
  },
  {
    pattern: /replaces? your doctor/i,
    severity: 'hard',
    why: 'Brand-suicide claim — we supplement, never replace',
    source: 'docs/05-voice-and-claims.md HARD FAIL',
  },
  {
    pattern: /you may have|we detected|you are at risk/i,
    severity: 'hard',
    why: 'Predictive / diagnostic language — describe data, never the user',
    source: 'docs/05-voice-and-claims.md + D8a §2.3',
  },
  {
    pattern: /AI Pulse Diagnosis|TCM diagnosis/i,
    severity: 'hard',
    why: "Urion's Chinese marketing — outside cleared IFU",
    source: 'docs/05-voice-and-claims.md HARD FAIL',
  },

  // --- Fear language (D11 §3.2 + docs/05) ---------------------------
  {
    pattern: /silent killer/i,
    severity: 'hard',
    why: 'Fear language — calm before clever',
    source: 'D11 §3.2 + docs/05',
  },
  {
    pattern: /ticking time bomb/i,
    severity: 'hard',
    why: 'Fear language — calm before clever',
    source: 'D11 §3.2 + docs/05',
  },
  {
    pattern: /before it'?s too late/i,
    severity: 'hard',
    why: 'Fear language — calm before clever',
    source: 'D11 §3.2 + docs/05',
  },
  {
    pattern: /medical advice/i,
    severity: 'hard',
    why: "We don't give it — say \"Talk to your doctor\"",
    source: 'D11 §3.2',
  },
  {
    pattern: /(?:dangerous|critical) (?:level|levels|range|reading)s?/i,
    severity: 'hard',
    why: 'Fear language — use the calm-concerned/confirmed-urgent phrasing',
    source: 'docs/05-voice-and-claims.md HARD FAIL',
  },

  // --- Onboarding self-help / urgency (docs/05) ---------------------
  {
    pattern: /take control of your hypertension/i,
    severity: 'hard',
    why: 'Self-help cliché — brand voice is calmer',
    source: 'docs/05 + D8a §3.4',
  },
  {
    pattern: /don'?t wait|start today|you owe it to yourself/i,
    severity: 'hard',
    why: 'Urgency in onboarding — calm-before-clever',
    source: 'docs/05 + D8a §3.4',
  },

  // --- D11 §3.3 quantified-self / fitness-bro / gamification --------
  {
    pattern: /\bbiohacks?\b|\bbiohacking\b/i,
    severity: 'hard',
    why: 'Quantified-self bro vocabulary',
    source: 'D11 §3.3',
  },
  {
    pattern: /\boptimi[sz]e[sd]?\b|\boptimi[sz]ation\b|\boptimi[sz]ing\b/i,
    severity: 'hard',
    why: 'Quantified-self vocabulary — describe what changes, not "optimisation"',
    source: 'D11 §3.3',
  },
  {
    pattern: /\bperformance\b/i,
    severity: 'soft',
    why: 'Quantified-self adjacent — review for context (athletic/HR perf is OK; "boost performance" is not)',
    source: 'D11 §3.3',
  },
  {
    pattern: /\b(?:streaks?|level up|levelled up)\b/i,
    severity: 'hard',
    why: 'Gamification — leiko has no streaks, no levels',
    source: 'D11 §3.3 + CLAUDE.md anti-pattern',
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
    why: '"Smart" applied to features is meaningless in 2026',
    source: 'D11 §3.3',
  },

  // --- D11 / Learn module / D9 prescriptive language ----------------
  {
    pattern: /\byou (?:should|must|need to|have to)\b/i,
    severity: 'hard',
    why: 'Prescription — use "people often"/"research suggests"/"some find"',
    source: 'Learn module §2 (the prescription trap) + D9 §2.3',
  },
  {
    pattern: /\bloved ones?\b/i,
    severity: 'hard',
    why: 'Generic, emotionally flat — be specific ("your mom", "your dad", "your aunt")',
    source: 'docs/05 HARD FAIL',
  },

  // --- Outcome-promising patterns -----------------------------------
  // These are caught at substring level. Context can rescue, so soft.
  {
    pattern: /will lower your (?:bp|blood pressure)/i,
    severity: 'hard',
    why: 'Outcome promise — describe what evidence shows, not what we will cause',
    source: 'D11 §3.2 + Learn module §2',
  },
  {
    pattern: /will help you live longer/i,
    severity: 'hard',
    why: 'Outcome promise',
    source: 'D11 §3.2',
  },
  {
    pattern: /will (?:reduce|lower|prevent|cure|fix)/i,
    severity: 'soft',
    why: 'Outcome-promising verb form — review for context',
    source: 'D11 §3.2',
  },

  // --- Formatting hard fails ----------------------------------------
  {
    pattern: /!{2,}/,
    severity: 'hard',
    why: 'Multiple !! is shouting',
    source: 'docs/05 HARD FAIL — formatting',
  },

  // --- D11 §3.3 soft warnings ---------------------------------------
  {
    pattern: /\bwellness\b/i,
    severity: 'soft',
    why: 'Too soft as a brand adjective — allowed in IFU-prescribed phrase "wellness reference" for SpO2',
    source: 'D11 §3.3',
  },
  {
    pattern: /\b(?:simple|easy|just)\b/i,
    severity: 'soft',
    why: 'Often condescending — review for tone',
    source: 'docs/05 SOFT WARNING',
  },
  {
    pattern: /\binsights?\b/i,
    severity: 'soft',
    why: 'When used as synonym for "graphs/charts", say "patterns" — D11 §3.3',
    source: 'D11 §3.3',
  },
];

// -----------------------------------------------------------------
// Strip helpers.
// -----------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
// `<Source>...</Source>` and `<Reading ... />` — strip whole.
const SOURCE_RE = /<Source\b[^>]*>[\s\S]*?<\/Source>/g;
const READING_RE = /<Reading\b[^/]*\/>/g;
// `<Definition term="x">...</Definition>` — keep the inner text since
// it's tooltip copy the user reads.
const DEFINITION_RE = /<Definition\b[^>]*>([\s\S]*?)<\/Definition>/g;
// `<CardLink id="x" />` — strip whole; the linked card is voice-checked
// on its own.
const CARDLINK_RE = /<CardLink\b[^/]*\/>/g;
const CODE_FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`\n]*`/g;
// HTML-style attributes inside any other tags we might miss.
const GENERIC_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;

function stripText(input: string, options: VoiceLintOptions): string {
  let s = input;
  if (options.stripFrontmatter !== false) {
    s = s.replace(FRONTMATTER_RE, '');
  }
  if (options.stripCodeBlocks !== false) {
    s = s.replace(CODE_FENCE_RE, '');
    s = s.replace(INLINE_CODE_RE, '');
  }
  if (options.stripMdxComponents !== false) {
    s = s.replace(SOURCE_RE, '');
    s = s.replace(READING_RE, '');
    s = s.replace(CARDLINK_RE, '');
    s = s.replace(DEFINITION_RE, (_, inner: string) => inner);
    // Anything left that looks like a tag — strip the wrapping but
    // keep the inner. We've already handled the structured ones.
    s = s.replace(GENERIC_TAG_RE, '');
  }
  return s;
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

// -----------------------------------------------------------------
// Public API.
// -----------------------------------------------------------------

/**
 * Scan a string for voice-rule violations.
 *
 * Returns the full result regardless of severity; callers decide
 * whether to fail-hard on `result.hardHits.length > 0` or to surface
 * soft warnings.
 */
export function lintVoiceText(
  input: string,
  options: VoiceLintOptions = {},
): VoiceLintResult {
  // We strip ONCE for matching, but report line numbers against the
  // ORIGINAL input — readers expect "line 47 of the article", not
  // "line 31 of the post-strip residue".
  const stripped = stripText(input, options);

  const hits: VoiceHit[] = [];

  for (const p of VOICE_PATTERNS) {
    // Make a fresh global-mode regex from the source so we can iterate
    // every match. The user-supplied regex may not be /g; we copy
    // flags + add g.
    const flags = p.pattern.flags.includes('g')
      ? p.pattern.flags
      : p.pattern.flags + 'g';
    const re = new RegExp(p.pattern.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(stripped)) !== null) {
      // Locate the same match in the ORIGINAL input for line-reporting.
      // Fall back to the stripped index if it's not present (rare —
      // the strip could remove the only occurrence in the source if it
      // sat inside an MDX component, which we don't lint).
      const originalIndex = input.indexOf(m[0], 0);
      const reportedIndex = originalIndex >= 0 ? originalIndex : m.index;
      hits.push({
        pattern: p.pattern,
        severity: p.severity,
        why: p.why,
        source: p.source,
        match: m[0],
        index: reportedIndex,
        line: lineOf(input, reportedIndex),
      });
      // Avoid zero-width infinite loops.
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }

  const hardHits = hits.filter(h => h.severity === 'hard');
  const softHits = hits.filter(h => h.severity === 'soft');
  return {
    hits,
    hardHits,
    softHits,
    passes: hardHits.length === 0,
  };
}

/**
 * Format hits as a single human-readable string. Used by Jest matcher
 * output and the CI scanner CLI.
 */
export function formatVoiceHits(hits: VoiceHit[]): string {
  if (hits.length === 0) return '(no voice-lint hits)';
  return hits
    .map(h => {
      const tag = h.severity === 'hard' ? 'HARD' : 'soft';
      const src = h.source ? ` [${h.source}]` : '';
      return `  line ${h.line} — ${tag} — "${h.match}" — ${h.why}${src}`;
    })
    .join('\n');
}

// supabase/functions/_shared/output-guard/diagnostic-cluster.ts — Sprint 12.
//
// The 10–15 diagnostic-leaning example phrases per D14 §12.2. Layer 2
// of the output guard embeds each of these once on the first warm-call
// of an Edge Function isolate (cached in module scope thereafter), then
// scores every Tier-B/C response against the cluster via cosine
// similarity. Anything ≥ 0.75 cosine to ANY cluster phrase fires the
// retry-then-DEFER flow per D14 §12.2.
//
// Choosing phrases:
//   - Pick the most-diagnostic surface forms the model is plausibly
//     tempted to use. The model has been trained on medical text; if
//     it slips, it will slip toward "this indicates X" / "you have Y"
//     / "increase your medication dose" / "based on these numbers,
//     you have Z" — those are the shapes here.
//   - Avoid phrases that overlap with PERMITTED speech. "Talk to your
//     doctor" is explicitly preferred per D11 §3.4 — it must NOT be
//     in this cluster, even though it has clinical valence. Likewise
//     general "see a doctor" framing is OK.
//   - Avoid covering ground Layer 1 already catches (literal forbidden
//     vocabulary). Layer 2's job is the SEMANTIC paraphrase the model
//     reaches for when it knows the literal word is forbidden.
//
// Updating this list:
//   When phrases are added or removed, the in-memory cache invalidates
//   automatically — the export is a fresh array on Edge Function cold
//   start. No DB migration; no build-script regeneration; no external
//   storage. The only thing that changes is the cosine-vs-cluster map.

export const DIAGNOSTIC_CLUSTER_PHRASES: ReadonlyArray<string> = [
  // Diagnostic claims
  "this indicates sleep apnea",
  "you have hypertension",
  "this is consistent with prediabetes",
  "this could be atrial fibrillation",
  "she likely has heart failure",
  "this confirms heart disease",
  "she is showing signs of dementia",

  // Risk prediction
  "your risk of stroke is elevated",
  "your numbers indicate heart attack risk",
  "based on these numbers you have hypertension",

  // Treatment / medication advice
  "increase your medication dose",
  "this medication will lower your blood pressure",
  "switch to a different beta blocker",
  "you should stop taking your blood pressure medication",

  // Authority + urgency framings (NOT "talk to your doctor")
  "you need to go to the emergency room immediately",
];

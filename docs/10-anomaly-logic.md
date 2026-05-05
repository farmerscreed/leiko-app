# 10 — Anomaly Logic

CANONICAL for Sprint 15. Sourced from D6 §5.11 (US-91 to US-95) and D8a §6 (anomaly banner UI). Voice rules from `docs/05-voice-and-claims.md` apply.

> **Hard rule** (D3 + CLAUDE.md): the anomaly engine surfaces a **statistical outlier**, never a clinical diagnosis. Language is descriptive ("higher than usual"), never diagnostic ("hypertensive crisis"). Detection logic is statistical, not clinical.

---

## 1. Three anomaly tiers

The engine emits one of three classifications per ingest:

| Tier | Trigger | UI surface | Push? |
| --- | --- | --- | --- |
| In-range | Reading within ± 2σ of the parent's 14-day baseline AND below absolute thresholds | Reading shown calmly. No banner. | Daily summary only |
| **Calm-concerned** | Statistical outlier (outside ± 2σ) OR exceeds soft thresholds (sys > 150 / dia > 95 / pulse > 120) | **Amber-accent banner** on home + Reading Detail. Body in Tone C (calm-concerned). | Yes — calm-concerned push category |
| **Confirmed-urgent** | Stage-2-sustained pattern (≥ 3 readings in 60 min above sys 160 or dia 100) OR Crisis range (sys ≥ 180 OR dia ≥ 120) | **Crimson** banner — the only place crimson appears | Yes — confirmed-urgent push category |

**Crimson is reserved for confirmed-urgent ONLY.** Per `docs/02-design-tokens.md` §1.3: "Crimson — 0% on a normal screen. Only when a confirmed clinical threshold is breached." Removing crimson by default IS the design default.

---

## 2. Detection algorithm (D6 US-91)

### Baseline computation
- Per parent (NOT per family), rolling window of last 14 days.
- Eligible readings: `hidden = false AND source = 'watch' AND quality_score IN ('good','fair')` (uses `readings_for_baseline` index from `docs/01-data-model.md`).
- Compute `baseline_sys`, `baseline_dia`, `baseline_pulse` (means) and `sigma_sys`, `sigma_dia`, `sigma_pulse` (population std dev).

### Outlier classification
Pseudocode (runs server-side on reading ingest, target latency < 5s from sync to classification):

```ts
function classifyReading(r: Reading, baseline: Baseline | null): Classification {
  // Cold-start path: no baseline yet
  if (!baseline || baseline.daysOfData < 14) {
    if (r.systolic >= 180 || r.diastolic >= 120) return { kind: 'confirmed_urgent', reason: 'crisis_absolute' };
    if (r.systolic > 160 || r.diastolic > 100 || (r.pulse ?? 0) > 130) return { kind: 'calm_concerned', reason: 'absolute_cold_start' };
    return { kind: 'in_range', reason: 'cold_start' };
  }

  // Hot path: with baseline
  if (r.systolic >= 180 || r.diastolic >= 120) {
    return { kind: 'confirmed_urgent', reason: 'crisis_absolute' };
  }

  const sysOutlier = Math.abs(r.systolic - baseline.sys) > 2 * baseline.sigmaSys;
  const diaOutlier = Math.abs(r.diastolic - baseline.dia) > 2 * baseline.sigmaDia;
  const pulseOutlier = r.pulse != null && Math.abs(r.pulse - baseline.pulse) > 2 * baseline.sigmaPulse;

  const exceedsSoft = r.systolic > 150 || r.diastolic > 95 || (r.pulse ?? 0) > 120;

  if ((sysOutlier || diaOutlier || pulseOutlier) && exceedsSoft) {
    return { kind: 'calm_concerned', reason: 'outlier_and_soft_threshold' };
  }
  return { kind: 'in_range', reason: 'within_baseline' };
}
```

### Sustained-pattern escalation (Confirmed-urgent path B)
Independently from per-reading classification, a **rolling 60-minute window** counts the parent's last hour of readings:

```ts
function checkSustainedPattern(recent: Reading[]): boolean {
  // recent = readings in last 60 min, ordered desc
  const stage2Hits = recent.filter(r => r.systolic > 160 || r.diastolic > 100).length;
  return stage2Hits >= 3;
}
```

If true → emit `confirmed_urgent` with `reason: 'stage2_sustained_60min'`.

### Weekly-trend escalation (D6 US-94)
The weekly summary job (Tier C, Sunday 18:00 caregiver-local-time) counts anomalies in the last 7 days. **3+ anomalies in 7 days** triggers an emphasised paragraph in the summary push:

> "Three readings this week were notably higher than Mom's usual range. This is worth a call to her doctor — would you like help drafting a message?"

Per D3: *"would you like help drafting a message"* is acceptable. *"Call 911"* is not. *"Tell her doctor immediately"* is not.

---

## 3. False-positive control (D6 US-93)

### Deduplication
After an anomaly fires, **the next anomaly within 4 hours is suppressed** (no new push, no new banner — but the reading itself is still saved and visible).

### Context-aware sensitivity
If the parent is in a known elevated context — caregiver manually annotated *"Mom was stressed"* via the comment thread, OR the parent self-flagged the reading as "I just exercised" — sensitivity is reduced for the next 24h. Specifically: the `2σ` outlier threshold becomes `2.5σ`, soft thresholds raise by 5 mmHg.

### Per-family tuning
Caregiver thumbs-down feedback (D6 US-65) on anomaly notifications adjusts the per-family sensitivity gradually. Implementation: a per-family `anomaly_sensitivity` float (0.8 to 1.5) multiplies the `σ` threshold. Default 1.0; thumbs-down nudges +0.05; thumbs-up nudges −0.02 (asymmetric — fewer false positives is more important than catching every outlier).

### Anomaly false-positive metric
Per `docs/13-testing-standard.md`:
- Target: ≤ 15% thumbs-down on anomaly notifications.
- Alert threshold: > 25% week-over-week.

---

## 4. Notification copy (D6 US-92)

The anomaly notification body uses one of three pre-approved templates:

| # | Template | Selection logic |
| --- | --- | --- |
| 1 | "Mom's reading just now was higher than usual: [SYS]/[DIA]. We've added it to her log." | Single outlier |
| 2 | "Mom's morning reading was elevated: [SYS]/[DIA]. The past few mornings have been higher than her usual range." | Morning trend (3+ mornings in 7 days are calm-concerned) |
| 3 | "A few of Mom's readings this week have trended higher. Worth a check-in when you can." | Weekly trend (3+ anomalies in 7 days, batched to weekly summary) |

For confirmed-urgent (per `docs/05-voice-and-claims.md` Tone D — Direct):

> "Three high readings in the last hour. We recommend reaching out to Dad now."

Per the voice rules:
- Title pattern: *"Worth a look"* (calm-concerned) or *"Please call Mum"* (confirmed-urgent).
- Body ≤ 120 chars iOS, ≤ 180 Android.
- Never "alert", "warning", "critical", or all-caps.

---

## 5. Banner UI (D8a §6)

### Calm-concerned banner
- Background: `color.state.warning` (amber #E89F4F)
- Foreground: `color.text.primary` (navy)
- Animation: gentle fade-in, `motion.normal` (200ms), `ease.decelerate`. **Never pulsing or attention-grabbing.** Per CLAUDE.md anti-pattern: "Animate anomaly banners aggressively. Calm-before-clever."
- Persistent until acknowledged or until next reading clears the trend.
- Tap target: opens Reading Detail with Inline Explainer pre-expanded (Surface B from `docs/08-learn-module.md`).
- Always includes a *"Why does this happen?"* link to a Learn card per the anomaly→card map below.

### Confirmed-urgent banner
- Background: `color.state.urgent` (crimson #8C2D2D)
- Foreground: `color.text.on-brand` (white)
- Animation: hard cut in (no fade) under reduced motion; `motion.normal` fade under default. Still calm.
- Pinned to top of home AND Reading Detail.
- Persistent until acknowledged AND a reading inside Stage 1 or below has been recorded.

### Anomaly → Learn card map (from `docs/08-learn-module.md` §7)

| Anomaly | Linked card(s) |
| --- | --- |
| Calm-concerned: 3 of 5 readings elevated | `numbers-002` + `changes-002` |
| Calm-concerned: missed readings 3+ days | `numbers-001` |
| Confirmed-urgent: Stage 2 sustained | `numbers-004` + `doctor-002` |
| Confirmed-urgent: Crisis (≥180/120) | `numbers-007` + `doctor-002` |

---

## 6. Feature gate (D6 US-95)

- **Free tier** sees the reading on the dashboard but **no proactive anomaly push**. An unobtrusive note on home: *"Get proactive alerts with Kena Plus"* (links to paywall).
- **Plus tier** receives anomaly pushes per category preferences (`docs/11-push-notifications.md`).
- The reading itself is never paywalled — only the proactive notification.

---

## 7. Testing requirements (Sprint 15)

Per `docs/13-testing-standard.md`:

- **Unit tests** for `classifyReading`, `checkSustainedPattern` — boundary cases at sys=149/150/151, dia=94/95/96, sigma boundaries, cold-start path.
- **Integration test**: a reading-ingest E2E that captures a synthetic reading, confirms anomaly fires within 5s, push payload uses the right template, and the banner renders with correct token colors.
- **Voice test**: forbidden-claim linter runs over all anomaly templates and AI escalation strings.
- **False-positive test**: a fixture of 200 historical reading sequences with hand-labeled "should anomaly fire?" — measure precision and recall against the labels.

---

## 8. Open anomaly questions
- Should the engine treat manual readings the same as watch readings? Currently yes (any source counted) — flagged for clinical advisor review.
- Pulse-only anomalies (sys/dia normal but pulse spike) — spec says fire calm-concerned; clinical advisor to validate threshold of 120.
- Pediatric / pregnancy thresholds — out of scope per IFU (engine returns `in_range` and a soft warning to remove watch from non-target user).

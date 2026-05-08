# Screen — Vital Detail · SpO2

Sprint 8.5 deliverable. One of the five per-vital detail screens reached
by tapping a constellation tile from the Self-Buyer Home (Sprint 8) or
the corresponding tile on the Caregiver Home in later sprints. Spec
sourced from `docs/_reference/D13-multi-vitals-constellation-spec.md`
§8.4 (SpO2 Detail) and §6.3 (SpO2 classifier).

---

## Audience
- Self-buyer (their own oxygen).
- Caregiver (parent's oxygen — same surface, third-person variants ship
  in Sprint 9).

## Purpose
Show the latest SpO2 + the overnight pattern. SpO2 is the closest signal
the app has to a clinical one (D13 §8.4: *"the most aggressive
defer-to-doctor copy of any vital"*) — the surface frames every notable
value as something to **share with your doctor**, never as a diagnosis,
warning, or alarm.

---

## Layout (top to bottom)

| Element | Spec |
| --- | --- |
| `DetailShell` chrome | Back chevron, "OXYGEN" eyebrow, ellipsis menu (Sprint 10 wires the per-vital sheet); subtle teal-tinted glow at top. |
| `VitalHero` | Ring + icon left; uppercase sub `Now · oxygen saturation`; giant primary percent (`98`) + small `%` secondary; tier-aware range line (see table below). `livePulse` is `false` for SpO2 — there's no continuous stream UX for oxygen. |
| `TimeRangePills` | `7d` / `30d` / `90d` (Sprint 8.5 ships display only; the chart is overnight-bucketed and ignores the range until Sprint 12). |
| `StatTrio` | `Overnight avg / Lowest / Awake avg` with units `%`, `briefly · 4 am`, `%`. |
| `VitalTrendChart` | Vital `spo2`, overnight series (last 11 samples), `range = [95, 100]`, `peak` + `trough` markers. Caption "Overnight · oxygen", subCaption "95–100 band". |
| `VitalInsightCard` | Tier-B AI placeholder body, voice-clean. Sprint 12.5 wires the real generator. |
| Eyebrow + `RecentReadingsList` | Last four readings. **No `onSelect`** at Sprint 8.5 — tap-into-reading is Sprint 9 territory. |

---

## Hero state copy (tier-aware)

| Tier | Sub | Range line under value | Insight body |
| --- | --- | --- | --- |
| `in_pattern` | `Now · oxygen saturation` | `Steady through the night` | "Your oxygen saturation held steady through the night with one brief dip around 4 am — nothing unusual. Healthy sleep often shows small, transient dips like this." |
| `calm_concerned` | `Now · oxygen saturation` | `Worth a look — share with your doctor at your next visit` | "Your overnight oxygen has held below 92% on a few recent nights. Worth mentioning at your next doctor visit." |
| `confirmed_urgent` | `Now · oxygen saturation` | `We recommend talking to your doctor soon` | "Your overnight oxygen has held below 90 on a few recent nights — worth mentioning at your next doctor visit." |
| no data (`null`) | `No oxygen samples yet` | `No oxygen samples yet today` | "Wear the watch overnight to start tracking your oxygen. We will surface an estimate of your overnight pattern after the first night." |

The classification tier comes from `useDailyPulseData().spo2.classification?.tier`
(D13 §6.3). All copy passes the canonical voice rules; no string mentions
"dangerous", "critical", "abnormal", "low oxygen", or "diagnose".

---

## Empty state

When `latestPercent === null`:
- Hero shows `—` (no `%` secondary), sub `No oxygen samples yet`, range
  `No oxygen samples yet today`.
- Below the hero: a single calm helper line — "Wear the watch overnight
  to start tracking your oxygen."
- The chart, stat trio, and readings list are **omitted** (D8 §6.4 —
  empty states explain what *will* happen, not what is missing).
- The `VitalInsightCard` still renders with the welcome body so the
  surface never reads blank.

---

## Behavior

- **Navigation**: opened by the Self-Buyer Home constellation tile-tap
  with `route.params.vital === 'spo2'`. The shell's back chevron calls
  the screen's `onBack` prop.
- **Time range**: Sprint 8.5 displays `7d/30d/90d` but the chart shows
  the latest overnight series regardless. Sprint 12 binds the range to
  the rendered series.
- **Live pulse**: never. SpO2 is sample-based, not streamed.
- **Recent readings tap**: not interactive in 8.5 (no `onSelect`). Sprint
  9 wires the per-row reading-detail.
- **Reduced motion** (D12 §7.4): inherited from `VitalHero` (static glow)
  and `VitalTrendChart` (instant draw-on) — no screen-level overrides.

---

## Voice rules (the longest section — SpO2 is the strictest surface)

The SpO2 detail screen is governed by `docs/05-voice-and-claims.md` plus
two extra constraints from D13 §6.3 + §8.4:

1. **Frame, don't alarm.** Any below-pattern value reads as something to
   *share with your doctor at your next visit* or *worth mentioning*.
   Never "your O2 is low", "dangerously low", "abnormal", or
   "alert/warning".
2. **Wellness oxygen estimate.** SpO2 is wellness-only on this device
   (D3 + voice rules table). The phrase "medical-grade SpO2" or
   "clinical SpO2" never appears. The reading-detail screen already
   carries the "wellness oxygen estimate" caveat — this screen does not
   re-state it inline (the caveat lives one tier up at reading-detail
   per `docs/04-screens/reading-detail.md` §"Secondary stats row").
3. **Overnight dips are normal.** "Healthy sleep often shows small,
   transient dips like this" is the tone for `in_pattern`. Match it.
4. **Confirmed-urgent is still calm.** Direct ≠ panicky. The
   confirmed-urgent line — "We recommend talking to your doctor soon" —
   is the strongest language the surface ever uses; it does not say
   "today", "now", "immediately", or "urgent".
5. **No clinical verbs.** "Diagnose", "diagnostic", "predict",
   "prevent", "treat" are all forbidden site-wide and are tested for
   in `__tests__/SpO2Detail.test.tsx`'s voice gate.
6. **No fear words.** "Dangerous", "critical", "silent killer", "ticking
   time bomb", "before it's too late" — all hard fail.
7. **No depersonalising terms.** "Loved one", "patient", "user" are all
   hard fail.

The CI copy-lint (Sprint 1) catches generic violations; the per-screen
voice gate test catches the SpO2-specific extras (`abnormal`,
`medical-grade`, `clinical SpO2`, etc.).

---

## Sprint 8.5 acceptance criteria

- [x] Hero renders the latest percent + tier-based range copy for all
      three classification tiers (in_pattern, calm_concerned,
      confirmed_urgent).
- [x] Empty state renders the welcome helper line + calm insight body
      when `latestPercent === null`.
- [x] `VitalTrendChart` renders the overnight series with range
      `[95, 100]`, peak + trough markers, and the design's caption.
- [x] `RecentReadingsList` renders the last four readings without
      `onSelect` (tap-through deferred to Sprint 9).
- [x] Voice gate test asserts none of `dangerous`, `critical`,
      `diagnose`, `abnormal`, `medical-grade`, `clinical SpO2`,
      `loved one`, `patient`, `you may have`, `we detected`,
      `silent killer`, `predict`, `prevent` appears in any rendered
      string across all four states (three tiers + empty).
- [x] Dark-mode snapshot of the populated `in_pattern` surface.
- [x] `npx tsc --noEmit` and `npx jest src/screens/VitalDetail/__tests__/SpO2Detail.test.tsx`
      both pass locally.

---

References: `docs/_reference/D13-multi-vitals-constellation-spec.md`
§6.3 (SpO2 classifier), §8.4 (SpO2 Detail), §1 (vital colour);
`docs/05-voice-and-claims.md` (every user-visible string);
`docs/_reference/design-bundles.md` (design source location).

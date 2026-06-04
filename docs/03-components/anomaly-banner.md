# Component — Anomaly Banner

Sourced from D12 §11.2.6 (Sprint 7.6 ships the primitive; Sprint 15 wires it). The single in-app surface that tells the user something in the readings is worth attention. Two files:

- `apps/mobile/src/components/AnomalyBanner.tsx` — the **primitive**. Pure presentation; consumer supplies all copy.
- `apps/mobile/src/components/ScreenAnomalyBanner.tsx` — the **screen wrapper**. Reads the most-severe unacknowledged anomaly from the store, derives voice-correct copy, and renders the primitive.

> **Crimson appears here ONLY** (and on the confirmed-urgent reading card — `docs/03-components/reading-card.md`). Crimson (`color.state.urgent`) is reserved for the `confirmed-urgent` severity. The `calm-concerned` severity uses amber (`color.state.warning`), never crimson. See `docs/10-anomaly-logic.md` §4.

---

## ScreenAnomalyBanner (the wrapper)

The component screens actually mount. Wired on Home (caregiver + self-buyer), Reading Detail, and per-vital Detail screens (`docs/10-anomaly-logic.md` §4).

### Props

| Prop | Type | Purpose |
| --- | --- | --- |
| `vital` | `AnomalyVital` (`'bp' \| 'hr' \| 'spo2'`), optional | Scope the banner to a single vital — used by per-vital detail screens. |
| `readingServerId` | `string`, optional | Scope to one specific reading — used by Reading Detail. |
| `onTap` | `() => void`, optional | Override the default tap action. Defaults to navigating to the reading/vital detail via the module-level navigation ref. |

### Selection logic (most-severe-wins)

Three usage modes, resolved in priority order **per-reading > per-vital > home**:

- `readingServerId` set → the anomaly for that reading (`useAnomalyForReading`).
- else `vital` set → most-severe for that vital (`useMostSevereAnomalyForVital`).
- else → most-severe across the whole family (`useMostSevereAnomaly`).

"Most severe" ranks `confirmed_urgent` over `calm_concerned`, breaking ties by most-recent trigger time (`pickMostSevere` in `apps/mobile/src/state/anomalies.ts`). All three hooks are always called (stable hook order); only the scoped result is used.

**Renders nothing when there is no matching event** (`if (!event) return null`). Sleep and Activity never produce events (`docs/10-anomaly-logic.md` §1), so they never reach this banner.

### Copy derivation + recipient

The wrapper does not hardcode strings. It reads `account_type` from the auth store (defaulting to `'caregiver'`) and passes it as the `BannerRecipient` to `bannerCopyFor(event, recipient, 'Mum')` in `apps/mobile/src/utils/anomalyBannerCopy.ts`. That pure function returns `{ severity, title, body }` in the recipient's voice (caregiver third-person "Mum/Dad", self-buyer second-person "you"). The wrapper passes `severity`, `title`, `body` straight through to the primitive.

> `severity` is derived from the event tier: `confirmed_urgent → 'confirmed-urgent'`, everything else → `'calm-concerned'`. The crimson-only rule is therefore enforced by the tier, not by the call site.

### Tap + dismiss behaviour

- The primitive's CTA is always `{ label: 'See the reading', onPress: handleTap }`.
- `handleTap` logs `anomaly_banner_tapped` `{ vital, tier }` (no reading values — `docs/10-anomaly-logic.md` §3.3), then:
  - calls `onTap` if provided; else
  - navigates via the module-level `navigationRef` (no-op until the navigator is ready) — to `ReadingDetail` for a BP event with a `readingId`, otherwise to `VitalDetail` for that vital.
- **Dismiss is passed only for `calm-concerned`** events; it calls `acknowledge(event.id)`, which writes `acknowledged_at` and removes the row from the selector. Confirmed-urgent passes `undefined` for `onDismiss` — there is no dismiss affordance.
- `testID="screen-anomaly-banner"`.

---

## AnomalyBanner (the primitive)

Pure presentation. Generates no copy of its own and ships no fallback strings — `title`, `body`, and `cta.label` are consumer-supplied, so voice rules apply at the call site (here, in `anomalyBannerCopy.ts`).

### Props

| Prop | Type | Notes |
| --- | --- | --- |
| `severity` | `'calm-concerned' \| 'confirmed-urgent'` | Drives surface color, icon, elevation, dismiss affordance, and motion. |
| `title` | `string` | One-line heading (`type.title`). |
| `body` | `string` | One-line context (`type.bodyM`). |
| `cta` | `{ label: string; onPress: () => void }`, optional | Right-aligned underlined text button beneath the body. |
| `onDismiss` | `() => void`, optional | Wired to a top-right X — **rendered only when `severity='calm-concerned'`** and a callback is provided. Ignored for confirmed-urgent. |
| `testID` | `string`, optional | Suffixed for sub-elements: `-icon`, `-dismiss`, `-cta`. |
| `style` | `StyleProp<ViewStyle>`, optional | Merged onto the animated container. |

### Variants (severity-driven)

| | `calm-concerned` | `confirmed-urgent` |
| --- | --- | --- |
| Surface | `color.state.warning` (amber) | `color.state.urgent` (**crimson**) |
| Text | `color.text.onBrand` | `color.text.onUrgent` |
| Icon | Phosphor `WarningIcon`, `iconSize.l` | Phosphor `WarningCircleIcon`, `iconSize.l` |
| Elevation | `elevation.none` (the accent surface carries its own weight) | `elevation.high` (feels weighted; rim-light on dark mode) |
| Dismiss X | Rendered when `onDismiss` provided | Never — "must be acted on" (D12 §11.2.6) |
| Radius | `radius.m` | `radius.m` |

Both variants share: left-aligned icon, `spacing.m` gap, title (`spacing.xs` below) + body in a flexible copy column, optional CTA row (`spacing.m` above, right-aligned, underlined).

> **Crimson is gated by `severity='confirmed-urgent'`.** Amber for calm-concerned. This matches the reading-card and Pill rules: crimson `urgent` styling lives only in the reading card and this banner (`docs/03-components/pill.md`, `docs/03-components/reading-card.md`).

### Motion (sheet-rise from the top)

- **Appears**: `translateY` animates from `-100` (offscreen above) to `0` over `motion.slow` (`duration.slow`):
  - `calm-concerned` → spring (`spring.default`).
  - `confirmed-urgent` → decelerate timing (`Easing.bezier(0,0,0,1)`) — restraint, no bounce. Calm-before-clever (`docs/10-anomaly-logic.md` §4; CLAUDE.md anti-pattern: don't animate anomaly banners aggressively).
- **Reduced motion**: hard-cut to position `0`, no animation at all. `translateY` is initialised at rest when `useReducedMotion()` is true, and the entry effect early-returns. (`apps/mobile/src/theme/useReducedMotion.ts`.)

### Accessibility

- Root: `accessibilityRole="alert"`.
- `accessibilityLiveRegion`: `"assertive"` for confirmed-urgent, `"polite"` for calm-concerned.
- Composed `accessibilityLabel`: `"<severity humanized> alert: <title>. <body>"`, where the humanized severity is `"Urgent"` (confirmed-urgent) or `"Worth-a-chat"` (calm-concerned).
- Dismiss X: `accessibilityRole="button"`, `accessibilityLabel="Dismiss alert"`, hit slop 12.
- CTA: `accessibilityRole="button"`, `accessibilityLabel = cta.label`, hit slop 8.
- Color is never the sole signal — severity also changes the icon (`Warning` vs `WarningCircle`), the live-region urgency, and the copy.

---

## Voice rules

Per `docs/05-voice-and-claims.md`. The primitive lints clean (no authored copy). The strings come from `anomaly-banner-copy` and `bannerCopyFor`, which CI voice-lints across every (vital × tier × recipient) combination (`docs/10-anomaly-logic.md` §4 / §7):

- **calm-concerned** titles use "Worth a look" — never "Alert"/"Warning"/"Critical".
- **confirmed-urgent** is direct but calm — "Please call Mum" / "Please call your doctor", "We recommend reaching out now/today". No "dangerous level", "critical level", or fear language.
- Caregiver copy is third-person about a named parent; self-buyer copy is second-person.

---

## Anti-patterns

- **Don't use crimson outside `severity='confirmed-urgent'`.** Amber is the calm-concerned surface.
- **Don't add a dismiss affordance to confirmed-urgent** — it must be acted on.
- **Don't animate aggressively** — no bounce on confirmed-urgent; honour reduced motion with a hard cut. Calm-before-clever.
- **Don't author fallback copy in the primitive** — copy is supplied and voice-linted at the call site.
- **Don't put reading values in tap/dismiss analytics** — only `{ vital, tier }`.

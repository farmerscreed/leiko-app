# Sleep wake-time + timezone consolidation — engineering brief

**Sprint 18 follow-up · Surfaced 2026-05-22 PM**
**Founder priority: Option B** (HR-derived wake-time inference)

## The bug, in one sentence

Every sleep session displays wake time as `08:00 UTC` of the sleep
day, formatted into the device's local timezone — so a user in Lagos
(UTC+1) sees "9 AM wake" every single day regardless of when they
actually woke. The U16PRO watch firmware doesn't expose actual wake
time over BLE (the 0x07 sleep packet has only durations).

## Where it lives in code

### The synthesis line

`apps/mobile/src/services/sync/syncMultiVitals.ts:501-507`

```typescript
const dayStart = unixSecFromDayLocal(dayLocal);          // line 501 — UTC midnight
// ...
const sessionEndSec   = dayStart + 8 * 3600;             // line 506 — 08:00 UTC
const sessionStartSec = sessionEndSec - info.sleep.totalMinutes * 60;
```

And `unixSecFromDayLocal` at line 154-156:

```typescript
function unixSecFromDayLocal(dayLocal: string): number {
  return Math.floor(new Date(`${dayLocal}T00:00:00Z`).getTime() / 1000);
}
```

The `Z` forces UTC parsing. `profile.timezone` is **never read** on
this path.

### Display formatters that compound the issue

| File | Function | What it does today |
|---|---|---|
| `apps/mobile/src/components/SleepStagesBar.tsx:53-58` | `formatClock(sec)` | `toLocaleTimeString([], ...)` — uses device-OS timezone, not `profile.timezone`. Renders the synthesized 08:00 UTC as "9:00 AM" in Lagos. |
| `apps/mobile/src/screens/VitalDetail/SleepDetail.tsx:99-112` | `bedTimeSub(start, end)` | Same — uses `[]` locale, displays "Last night · 10:22 pm → 9:00 am". |
| `apps/mobile/src/state/sleep.ts:130-141` | `lastNightSession(nowSec)` | Uses 36h lookback window — fine, internal. |
| `apps/mobile/src/state/sleep.ts:143-151` | `recentSessions(nowSec, nights)` | Uses 14-day cutoff — fine, internal. |

The internal aggregation paths are OK (they work on epoch seconds).
The display + the synthesis are the bugs.

### Same hardcoded-UTC pattern lives at lines 545 / 548 / 551 / 558

```typescript
const dayStart = unixSecFromDayLocal(dayLocal);              // line 545
// ...
measuredAtSec: dayStart,                                       // line 548
// ...
lastSampleAtSec: dayStart + 23 * 3600 + 59 * 60,              // line 551
// ...
measuredAtSec: dayStart,                                       // line 558
```

These are for activity-day ingest. Same conceptual bug — anchoring
"end of day" to UTC offsets — but with smaller user-facing impact
because Activity doesn't display these timestamps directly. Still
worth fixing while we're in the area.

## Founder-approved approach: Option B

HR-derived wake-time inference. The watch records HR samples
continuously (5-min cadence per the index packet). When the user
wakes and starts moving, HR rises sharply. The heuristic:

1. Take the synthesized sleep window (still anchored to date, but
   widened: e.g. 20:00–11:00 local).
2. Scan the HR samples in that window.
3. The "wake" inflection = the first HR sample after the
   sleep-window minimum where:
   - HR > sleeping_baseline + 15 bpm (or similar threshold), AND
   - The sample is followed by 2+ more samples also above that
     threshold (so we don't pick up a brief HR spike during sleep).
4. That sample's `measuredAtSec` is the wake time.
5. sessionEndSec = that wake measuredAtSec.
6. sessionStartSec = sessionEndSec − totalMinutes × 60 (preserves
   the watch's accurate total).

Fallback when HR samples are missing: a calibrated user-tz-aware
synthesis (e.g. wake = 07:00 in `profile.timezone`, properly offset
to UTC for storage). This is better than 08:00 UTC but still
imperfect — surfaces a clear "approximate" marker in the UI.

## Founder also asked: confirm timezone is sourced from profile

Audited 2026-05-22. The user's IANA timezone is correctly:
- Captured during onboarding (`SelfBuyerYouScreen` line 235's
  `TimezonePicker`).
- Stored in `public.users.timezone` (via `completeSelfBuyer` line
  327: `timezone: selfBuyer.timezone || defaultTimezone()`).
- Editable in Settings → Profile → Timezone row (line 451-456).
- Reachable as `useAuth.profile?.timezone` at runtime everywhere.

The plumbing is intact. The bug is purely that **the sleep paths
don't consult it.**

## Scope for one commit

### 1. New `apps/mobile/src/utils/userTz.ts`

```typescript
import { useAuth } from '../state/auth';

/** Return the user's chosen IANA timezone, falling back to the
 *  device-OS timezone. Stable across renders unless profile changes.
 *  Read-only — for display formatting + DST-aware date math.
 */
export function userTz(): string {
  const profile = useAuth.getState().profile;
  return profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Hook form for components. */
export function useUserTz(): string {
  return useAuth((s) => s.profile?.timezone) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Format an epoch-sec timestamp as a clock time in the user's tz.
 *  E.g. formatClockInTz(1716368520, 'Africa/Lagos') → '9:42 AM'. */
export function formatClockInTz(sec: number, tz: string): string {
  return new Date(sec * 1000).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
  });
}
```

### 2. HR-derived wake inference in syncMultiVitals.ts

Replace lines 503-507 with a call to a new pure helper
`inferWakeFromHR(hrSamples, dayLocal, userTz)` that returns
`{ sessionEndSec, sessionStartSec, source: 'hr_inferred' | 'fallback' }`.

Helper lives at `apps/mobile/src/services/sleep/inferWakeFromHR.ts`
— pure, testable, no React. Logic:

```typescript
export function inferWakeFromHR(
  hrSamples: HRSample[],
  dayLocal: string,
  totalMinutes: number,
  tz: string,
): { sessionEndSec: number; sessionStartSec: number; source: 'hr_inferred' | 'fallback' } {
  // 1. Window: 20:00 the prior local day → 11:00 the dayLocal day.
  //    Convert window bounds to epoch sec via tz-aware date math.
  // 2. Filter hrSamples to that window.
  // 3. Find the sleep-window minimum HR (within 02:00–06:00 local).
  // 4. Walk forward from min HR; find first sample where:
  //    - sample.bpm > min + 15
  //    - next 2 samples also > min + 10
  //    Return that sample.measuredAtSec as sessionEndSec.
  // 5. If <3 samples in window or no inflection found:
  //    fallback to userTz-aware 07:00-local synthesis.
}
```

Persist `source` on the SleepSession so the UI can mark inferences
as approximate.

### 3. Display fixes

- `SleepStagesBar.tsx:53-58` — `formatClock` takes a `tz` param.
- `SleepDetail.tsx:99-112` — `bedTimeSub` takes a `tz` param.
- Both screens read `useUserTz()` and pass it through.

### 4. The `source` marker on the SleepSession

```typescript
interface SleepSession {
  // ... existing fields
  /** Sprint 18 — how sessionStart/End were derived. 'hr_inferred'
   *  when we had enough HR samples around the wake window;
   *  'fallback' when we used the 07:00-local synthesis. */
  wakeSource?: 'hr_inferred' | 'fallback';
}
```

UI affordance: when `wakeSource === 'fallback'`, the "Woke" time
chip in SleepStagesBar gets a faint "approx." caption underneath
(or we hide the time entirely if we want stricter honesty).

### 5. Tests

- `inferWakeFromHR.test.ts` — fixture-driven. ~10 cases covering:
  - Normal night (clear HR inflection) → correct wake time.
  - HR samples missing entirely → fallback.
  - Brief HR spike at 3 AM (toilet trip) doesn't count as wake.
  - Multiple inflections — earliest valid one wins.
  - User in non-UTC tz → wake correctly localized.
- `userTz.test.ts` — fallback chain (profile → device OS).
- `SleepStagesBar.test.tsx` — formatClock honors `tz` prop.
- `SleepDetail.test.tsx` — new "wakeSource: fallback" test ensures
  the approx marker appears.

### 6. Migration / data backfill

Existing SleepSession rows in MMKV and Supabase have the broken
synthesized times. Two options:

**A — Leave historical rows alone.** The synthesis applies only at
INGEST time. New nights get HR-derived. Old nights keep the fake
08:00-UTC wake. Cleanest, but the user's history shows mixed
sources.

**B — Re-derive on hydrate.** When `useHydrateSleepFromServer` (or
the slice's `addPending`/`acceptSyncResult`) sees a row without
`wakeSource`, run `inferWakeFromHR` against the existing HR slice
to backfill. Slow on cold start, correct.

**Recommendation: A for v5.** B is a follow-up if users complain.

## Out of scope (defer to v1.1)

- A full slice-wide `dayLocal`-is-actually-UTC rename (mentioned in
  `memory/sprint_18_audit_pass_close_out.md`).
- Activity day-end synthesis at line 551
  (`dayStart + 23 * 3600 + 59 * 60`). Same conceptual issue but
  doesn't display to user, fix when convenient.
- Sleep stage hypnogram (would need either the firmware to expose
  transitions OR a richer HR-state-machine analysis). Sprint 16.5c
  already documented this gap; not in scope for sleep wake fix.

## Acceptance criteria

1. A user in Lagos sees their actual wake time in the SleepStagesBar
   "Woke" chip (matching their phone's wake-up clock check ±5 min),
   NOT a constant 09:00.
2. A user in US Eastern (UTC-5) sees their actual wake time, NOT
   a constant 03:00.
3. SleepDetail hero's `bedTimeSub` reflects the inferred times.
4. When HR data isn't available, the wake time displays with an
   "approx." marker (or hides entirely).
5. All `formatClock` / time-display call sites in sleep screens
   read from `useUserTz()`, not from `[]` (OS default).
6. Tests cover the new helper end-to-end + the fallback path.

## Estimated effort

3–4 hours of focused work. Bigger if Migration option B is chosen,
or if the HR inflection heuristic needs more tuning than the first
pass.

## How this lands

One commit, pushed to `claude/competent-goldberg-737194` (or a
sub-branch). Once tested + reviewed, **v5 APK build is queued**
alongside the icon work — these two changes ship together so we
don't burn two APK cycles for two cosmetic-adjacent fixes.

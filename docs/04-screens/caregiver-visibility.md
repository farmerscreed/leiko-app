# Screen — Caregiver visibility ("Who sees my readings")

Sourced from D13 §13.2 + D8a §10.4, preserved and relocated by **ADR-0006 §4**.
The wearer's per-caregiver, per-vital sharing control. One toggle group per
follower; blood pressure is always shared, sleep is off by default.

> **Implementation**: `apps/mobile/src/screens/CaregiverVisibility/CaregiverVisibilityScreen.tsx`
> (Sprint 10c.2; Sprint 17b tightened the loading/error rendering). Registered
> on both stacks in `apps/mobile/src/navigation/RootNavigator.tsx` as
> `CaregiverVisibility`. Backing service:
> `apps/mobile/src/services/families/visibility.ts`.

---

## Audience

The **wearer** of a circle — the person whose readings are being shared. In
`account_type` terms that is the self-buyer / `parent_owner`; in ADR-0006
terms it is the viewer on **a circle they wear**. Followers never reach this
screen for a circle they merely follow (ADR-0006 §4: "no visibility editor"
on followed circles).

The screen does not gate on role itself — it lists `family_members` where
`role = 'caregiver'` for the circle and lets the viewer edit each one. Access
is gated upstream by where it's linked from (owner-only entry points).

## Purpose

- List every caregiver who follows the wearer's circle.
- Per caregiver, toggle which vitals they can see: BP, heart rate, oxygen,
  sleep, activity.
- Enforce the privacy posture: **BP always on** (toggle disabled), **sleep off
  by default**.

---

## When reached

- **Settings → "Following your readings" → "Who sees my readings"**
  (`SettingsScreen.tsx`, `stackNavigation.navigate('CaregiverVisibility')`).
  That row only appears when the viewer wears a circle **and** has at least
  one follower (`caregiverCount > 0`).
- **Family members screen (owner view) → "Sharing" → "Manage what each
  caregiver sees"** (`FamilyMembersScreen.tsx`,
  `navigation.navigate('CaregiverVisibility')`).

The circle is `parents[0]?.familyId` from `useFamilyReadings()` — a single
`familyId`, no route param. Like Family members, it always targets the first
circle in that hook.

---

## Layout (top to bottom)

| Element | Detail |
| --- | --- |
| Back affordance | Text "Back", `brand.primary`, `accessibilityRole="button"` |
| Header | "Who sees my readings" (`displayM`, `accessibilityRole="header"`) |
| Subhead | "Choose what each caregiver can see. Blood pressure is always shared." |
| Per-caregiver section | One `SettingsSection` per caregiver, titled with their display name, containing five toggle rows |

### Vital toggle rows (fixed order, `VITAL_ROWS`)

| Key | Title | Subtitle | Behaviour |
| --- | --- | --- | --- |
| `bp` | Blood pressure | "Always visible." | Toggle **disabled**; `onToggle` also no-ops on `bp` if a tap races through |
| `hr` | Heart rate | — | Editable |
| `spo2` | Oxygen | — | Editable |
| `sleep` | Sleep | "Off by default. Sharing sleep is optional." | Editable; defaults off |
| `activity` | Activity | — | Editable |

Toggling is **optimistic**: the row flips immediately, then
`setCaregiverVisibility(familyId, caregiverUserId, visibility)` persists. On
failure it rolls back and surfaces "We couldn't save that change. Try again
in a moment."

### Visibility defaults + BP enforcement

Defaults live in `services/families/visibility.ts` `DEFAULT_VISIBILITY` and
apply when `family_members.vital_visibility` is null: `bp: true, hr: true,
spo2: true, sleep: false, activity: true`. BP is coerced to `true` on **both**
read (`getEffectiveVisibility`) and write (`setCaregiverVisibility` forces
`bp: true`) — defence in depth so BP can't be hidden even by editing the JSONB
directly. The screen renders the *actual* stored sleep value (off), it does
not mask the default — per the screen's own comment, the wearer should see
the real privacy posture before changing it.

---

## States

| State | What renders (`testID`) |
| --- | --- |
| `loading` | "Loading…" (`caregiver-visibility-loading`) while `caregivers === null` |
| `error` | "We couldn't load your caregiver list. Pull down to retry." (`caregiver-visibility-error`). Sprint 17b made error/loading mutually exclusive so both never show at once |
| `empty` | "No caregivers yet. Invite one from Settings → Family." (`caregiver-visibility-empty`) — list loaded, length 0 (also the no-circle case) |
| `default` | One toggle section per caregiver |

A save failure does not clear the list — it rolls the toggle back and shows
the inline error string while the sections stay rendered.

---

## Relationship to settings.md + ADR-0006

- ADR-0006 §4 explicitly **preserves this feature in full** and relocates it:
  the standalone route survives, reached from the wearer's "Following your
  readings" Settings section (and from the owner's Family members "Sharing"
  link), rather than from a top-level Family menu. This doc records that the
  `CaregiverVisibilityScreen` is "unchanged — BP always-on, Sleep off by
  default", exactly as the ADR states.
- `settings.md` lists "Sleep-hidden-by-default for hybrid-mode caregiver
  visibility" as a 10c item; this screen is that delivery. The
  Apple-Health/per-vital toggles in `settings.md` are a **different** surface
  (phone health-app sync) — this screen governs what *human followers* see,
  not what the OS health app ingests.
- One-wearer-per-circle (ADR-0006) is what makes "who sees my readings"
  unambiguous: there is exactly one wearer whose vitals are being shared.

---

## Voice

Per `docs/05-voice-and-claims.md`:
- "Oxygen" not "SpO2" / no "clinical" qualifier in the row title — plain
  language first.
- Subheads are calm and non-coercive ("Sharing sleep is optional.").
- Error copy names a calm cause + retry; no codes, no fear language.
- No "patient" anywhere; the subject is "you" (the wearer) and named caregivers.

---

## Accessibility

- Header `accessibilityRole="header"`; Back `accessibilityRole="button"`.
- Toggle rows are `ListRow variant="toggle"` (switch semantics handled by the
  component). The BP row is `disabled`, so it is announced as non-interactive.
- Each section is titled with the caregiver's name so a screen-reader user
  knows whose sharing they're editing.

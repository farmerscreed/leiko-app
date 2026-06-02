# Start here — ADR-0006/0007 unified model + Connect invites (2026-06-02)

Last touched: 2026-06-02. Branch `claude/consolidated-build`, tip `88a8b8d`
(pushed to origin). Supersedes the 2026-05-24 Sprint-19 handoff.

## 60-second context

This session reshaped the **whole family/home/invite model** and fixed a
chain of data bugs, across ~45 commits on `claude/consolidated-build`.
Two ADRs were written, approved, and **fully built + device-verified**:

- **ADR-0006** (`docs/_adr/0006-…`): unified caregiver/self-buyer model —
  one "circles" concept, `account_type` made inert, one constellation
  home where the viewer is a node, Settings collapsed to 2 role-aware
  sections. **Status: Accepted.**
- **ADR-0007** (`docs/_adr/0007-…`): unified "Connect" invite — one code,
  backend infers who-follows-whom from who wears a watch. Replaced the
  confusing 3-button / 4-edge-function system. **Status: Accepted.**

Everything below the "deploy" section has been confirmed working on real
devices (3 phones, 2 watches) by the founder.

## ⚠️ The one big loose end

**Nothing is merged to `main`.** All ~45 commits live only on
`claude/consolidated-build` (237 ahead of `main`). A PR to land this is
the top priority — see "Next steps".

## What's working RIGHT NOW (built, tested, mostly device-verified)

Phases (ADR-0006):
- ✅ **Phase 1 — Stabilise:** device-authoritative deterministic sync
  routing (`sync/index.ts` resolveFamilyAndDevice); `create_family`
  self-circle idempotency guard (migration 0028); one-time prod data
  cleanup done.
- ✅ **Phase 2 — Unified home:** one constellation; viewer is a node;
  urgency ordering (`constellationOrder`/`constellationNodes`).
- ✅ **Phase 3 — self-as-centre (beating orb), bottom tab bar, Ask-Leiko
  in header, unified onboarding (no fork; everyone self_buyer),
  "I have the watch" → opens pairing, default view by circle size.**
- ✅ **Phase 4 — Settings → 2 role-aware sections** (Following your
  readings / People you care for) + per-vital visibility preserved.

Invites (ADR-0007):
- ✅ **`connect-create` + `connect-accept`** edge functions. Direction
  resolved from watch ownership: one wearer → other follows; both wear →
  accepter follows + `canFollowBack` (ASK, not auto-mutual); neither →
  pending. Email-match guard kept.
- ✅ Client `createConnect` / `acceptConnect`; UI = one Connect sheet +
  one Enter-a-code sheet. Home "+ Add someone" and Settings both use them.
- ✅ Dual delivery (link + 6-digit code); deep-link `join` route.

Fixes this session:
- ✅ HR backfill render-storm (cold-start froze the home) → batched insert.
- ✅ Android keyboard covering invite email field → behavior="height".
- ✅ Caregiver only saw ONE wearer → `isSelfCircle` now requires
  family_owner (every wearer's circle is 'self'); all wearers orbit.
- ✅ Empty "You" node for watchless caregivers → hidden until real data.
- ✅ Tab bar pushed Settings off-screen → tightened spacing.
- ✅ Demographics nudge (height/weight drive watch step/calorie accuracy).
- ✅ Orb heartbeat (lub-dub) halo pulse.
- ✅ Real server error surfaced from functions.invoke (was generic).

## Migrations + edge functions deployed to prod this session

- Migrations: **0027** (devices.client_device_id), **0028**
  (create_family self idempotent), **0029** (invitations.family_id
  nullable for pending/connect).
- Edge functions deployed: **sync** (re-stamp + routing), **send-family-
  invite** (url_token), **send-care-invite**, **resolve-care-invite**,
  **connect-create**, **connect-accept**.

## DB state (prod, after this session's cleanup)

Only **`lawonecloud@gmail.com`** (Lawrence) + test signups remain. All old
test accounts hard-deleted; orphan circles soft-removed. Lawrence's circle
`21b057bb-…`, ~87 BP, one active U19M device `5a2a24f5`.

## Known deferrals (documented, NOT bugs)

1. **Old 4 invite edge functions** (send-family-invite, accept-family-
   invite, send-care-invite, resolve-care-invite) are now dormant —
   nothing calls them. Retire after a back-compat window for any
   already-issued codes.
2. **No app-store listing / `leiko.app/join` page** — invite LINKS only
   work for someone who already has the app. Test invites via the 6-digit
   CODE. Store listing + join landing page are launch tasks.
3. **Demographics in onboarding** — currently a post-onboarding nudge
   (founder chose this over an onboarding step). Revisit if signup data
   completeness matters.
4. **`tryResolvePendingCareInvite`** is now a no-op (connect-accept needs
   the accepter's email; a stashed deep-link code doesn't carry it). The
   person completes via the Enter-a-code sheet.
5. **Full `account_type` column/nav removal** — ADR-0006 made it inert at
   the render layer; the column + nav branch still exist (deliberately).

## Next steps (priority order)

1. **Open a PR `claude/consolidated-build` → `main` and merge.** This is
   the critical loose end. (A draft PR #8 may exist; it predates ~40
   commits — refresh its description or open fresh.)
2. **Finish the production test** (`plans/comprehensive-test.md`): the
   full 3-phone connect matrix, visibility toggles, the both-wear
   "follow back" path.
3. **Retire the old 4 invite edge functions** once the back-compat
   window closes.
4. Build/flash a fresh APK from `main` after merge.

## Test plan

`plans/comprehensive-test.md` — stage-by-stage, with SQL checkpoints +
device/account map. Connect flow now: anyone shares a code, the other
enters it, backend wires direction. No direction-picking.

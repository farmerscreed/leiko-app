# ADR-0006: Unify the caregiver / self-buyer model — `account_type` becomes inert

- **Status**: Proposed (awaiting founder sign-off)
- **Date**: 2026-06-01
- **Sprint**: TBD (supersedes the "onboarding redesign" non-goal of `plans/sprint-19-multi-account-caregiver-model.md`)
- **Amends**: `docs/_reference/D8a-self-buyer-mode.md` §1.2, §1.3, §14.1; `docs/01-data-model.md` (users.account_type semantics)
- **Touches**: onboarding, home/dashboard, settings (family), sync family-routing, `create_family` RPC

## Context

Leiko ships two personas, chosen once on an onboarding fork and frozen in
`users.account_type` (`caregiver` | `self_buyer` | `parent`):

- `self_buyer` → a single-protagonist app ("Your readings"). Cannot show
  anyone else.
- `caregiver` → a family-circle app (orbs / cards of other people). Has
  no concept of the viewer's *own* readings.

D8a §1.2 made this binary deliberate ("two parallel React Navigation root
stacks, selected by account_type… not a leaky toggle"). D8a §14.1 codified
the escape hatch as "contact support, make a new account."

### What forced this ADR

Founder hands-on testing + a deep DB/code investigation (session
2026-06-01) surfaced that this binary cannot express the most common real
shape: **a person who both wears a watch themselves AND watches over one
or more loved ones.** The founder (account_type `self_buyer`, owns the
"Lawrence/self" family) tried to add a second person to care for and hit a
wall — the flow created a dangling, person-less, device-less family
(`addAnotherFamily` → `create_family` → `goBack()`, no invite, no pairing),
and the self-buyer home could never display it anyway.

The investigation also confirmed three structural weaknesses behind the
visible symptom:

1. **Sync family-routing is non-deterministic.** `supabase/functions/sync/index.ts`
   resolves the wearer's family with `family_members … limit(1)` and **no
   `.order()`**. For any user in >1 family, watch data scatters between
   families run-to-run. (This was the original "caregiver shows 0 steps"
   report — data split 3/14 across two families.)
2. **`create_family` has no idempotency guard**, and the self-buyer
   auto-provision hook (`useEnsureSelfBuyerFamily`) has a check-then-create
   race → duplicate families possible.
3. **"Care for another person" is a dead end** — the `parent_pairing`
   invite kind exists in the schema (`invitations.kind`) and the invite
   edge functions exist, but nothing wires them into the add-person flow,
   so a newly-added wearer can never actually join + pair.

Sprint 19 patched the *cosmetic* edges of this (don't render "SELF" to a
caregiver, hide invite for non-owners, add a second-family CTA) but
**explicitly deferred the onboarding/model redesign** ("the current fork +
invite-code system stays shape-stable"). This ADR is that deferred
decision, taken deliberately.

## Decision

**Collapse the two-persona binary into one unified model. `account_type`
stops selecting the app's shape; it becomes an inert, retained column.**

The model is built on **one concept** and **two independent capabilities**:

- A **circle** = exactly one wearer + their one watch + zero-or-more
  followers. (This is today's `families` row, renamed in all user-facing
  copy — the word "family" disappears from the UI.) **One wearer per
  circle stays a hard invariant** — it is what keeps two people's medical
  data from sharing a bucket.
- Any user may **simultaneously**:
  - **own their own circle** (they wear a watch) — optional, and
  - **follow any number of other circles** (people they care for).

### What changes

1. **Onboarding** loses the persona fork. New flow:
   `merged intro → "You" (name, timezone, optional year-of-birth) →
   "Do you have a Leiko watch for yourself?" (Yes → pair now; Not yet →
   skip) → constellation home with "+ Add someone you care for."`
   Everyone onboards as the self-owning persona; the home's shape emerges
   from *what the user does* (paired a watch? added people?), not a box
   chosen once.

2. **Home** is a single constellation view at all member counts
   (birds-eye default, per founder). **The viewer is a node in their own
   constellation**, clearly marked "You", anchored (centre of birds-eye /
   top of cards). Solo (no one added) renders today's personal view
   unchanged. Adding the first person is a calm auto-reveal into the
   constellation. Tapping your own orb opens today's rich personal view
   (latest number, trend, "Take a reading"). Urgency reorders the view:
   amber slow-radiate for `elevated`; the reserved stronger treatment +
   top-pin (above even the "You" node) for `confirmed-urgent` only —
   honouring the "red = confirmed-urgent only / calm-before-clever" rule
   in CLAUDE.md.

3. **Invites: the wearer invites, the follower accepts.** The data owner
   controls access. The "Invite someone to follow" affordance appears
   **only on circles the viewer wears**; on circles they merely follow it
   is absent. (Resolves the "who generates the code" question and the
   "deactivate the unnecessary side" request.)

4. **Settings → Family collapses from ~6 sections to 2, role-aware:**
   - On a circle you wear → **"Following your readings"**: invite CTA +
     a row per follower; tapping a follower opens the **existing
     per-vital visibility controls** (`CaregiverVisibilityScreen`,
     unchanged — BP always-on, Sleep off by default) plus remove.
   - On a circle you follow → **"You're following [Name]"**: no invite,
     no visibility editor, just "Leave this circle."
   The per-caregiver vital-visibility feature is **preserved fully** —
   relocated from a standalone route to the follower-row detail.

5. **Sync routing becomes device-authoritative + deterministic.** Watch
   data is routed to **the circle the device is bound to** (`devices.family_id`),
   not "whichever family the syncing user happens to be in first." This
   makes the `clientDeviceId` work (the stable per-install identity added
   in the same investigation) the keystone of routing. The legacy
   membership fallback gains a deterministic `.order('joined_at')`.

6. **`create_family` gains an idempotency guard** for the self-owned
   circle, closing the duplicate-family race.

### What `account_type` becomes

`account_type` is `NOT NULL` and immutable, and the codebase branches on
it widely; we do **not** drop it. Instead **every new user is onboarded as
`self_buyer`** (the persona that owns its own circle and can add others),
and the runtime stops using `account_type` to pick the navigation tree or
home screen. It is retained for: existing-row compatibility, analytics
history, and any branch we cannot economically remove in phase 1. The
intent is "inert", not "deleted."

## Rationale

1. **The binary cannot model reality.** "Me + my two parents" is three
   nodes the self-buyer tree can't show and the caregiver tree strips the
   self from. Every founder scenario (buy-for-parents, buy-for-self-then-
   expand, start-self-then-care) is the same unmet shape. One unified view
   is the minimal model that holds all of them.
2. **It removes the immutability trap without fighting the column.**
   Making `account_type` inert means a self-buyer who later cares for
   someone simply taps "+ Add someone" — no account_type change, no new
   account, no support intervention (which D8a §14.1 currently requires).
   We get the outcome the founder wants while leaving the immutable column
   technically untouched.
3. **It reuses what exists.** Constellation view, personal hero view,
   per-vital visibility screen, invite edge functions, the
   `parent_pairing` invitation kind, `clientDeviceId` — all already built.
   This is mostly *composition and wiring*, not new primitives.
4. **Device-authoritative routing is the correct fix** for the original
   data-scatter bug, and it is only fully expressible once the watch has a
   stable identity (already shipped in this investigation).
5. **One concept simplifies everything downstream.** The founder's "5
   sections in Settings is too many" is a symptom of too many concepts
   pointed at the user. Collapsing to "circles, and am I the wearer or a
   follower here?" shrinks Settings almost for free.

## Consequences

- **Onboarding** (`src/screens/Onboarding/*`, `AccountTypeFork.tsx`,
  `state/onboarding.ts`): fork removed; intro sets merged; a watch-pairing
  step moves *into* onboarding. `completeWithWatchInHand` /
  `completeSelfBuyer` / `completeViaInvite` are reconciled into fewer
  paths.
- **Home** (`src/screens/Home/*`): the self-buyer personal home and the
  caregiver constellation home converge into one route that renders the
  viewer as a node. New "You" node treatment + urgency reordering rules.
- **Settings** (`SettingsScreen.tsx`, `CaregiverVisibilityScreen.tsx`,
  `FamilyMembers`, invite/accept sheets): family surface collapses to two
  role-aware sections; visibility controls move under the follower row.
- **Sync** (`supabase/functions/sync/index.ts`): family resolved from the
  bound device; deterministic membership fallback. (Builds on the
  `mutable`-daily-vitals + `clientDeviceId` changes already on the branch.)
- **RPC / migration**: `create_family` idempotency guard; possible
  migration to formalise device→circle binding. Any data-model change
  remains main-thread + ADR-gated per CLAUDE.md.
- **Spec docs**: D8a §1.2/§1.3/§14.1 and `docs/01-data-model.md`
  account_type semantics are amended to record the unified model. D8a's
  self-buyer *content* (voice, paywall framing, hero card) survives as the
  "you wear a watch" branch of the unified UI.
- **Existing accounts**: caregivers (no self-circle) and self-buyers (one
  self-circle) both map cleanly onto the unified home — a caregiver simply
  has no "You" node. No data migration of personas required.
- **The founder's live data** (Lawrence/self + the orphaned NaHim/uncle
  test family, the misrouted vitals) is cleaned up as a one-time step,
  tracked separately from this model work.

## Scope boundaries (explicit non-goals)

- **Many-people view (5–10 followers).** Structurally already supported;
  a vertical stack / constellation of 10 nodes is a *view* problem
  (list/density redesign) deferred to a later phase. Does not shape phase 1.
- **Billing model for multi-circle.** Subscription is per-circle today;
  "one subscriber, many circles" is a commercial decision tracked
  separately, not in this ADR.
- **Remote non-technical-parent setup at scale.** v1 assumes a family
  member does the in-person first-time setup (install + pair + share
  code) for a non-technical wearer. If field reality demands
  caregiver-driven remote setup, the invite direction is revisited.
- **Full parallel multi-session auth** (Sprint 19 non-goal) stays
  deferred.

## Rollout (phased — each phase independently shippable)

1. **Stabilise (no model change):** deterministic + device-authoritative
   sync routing; `create_family` idempotency guard; finish the one-time
   data cleanup. Stops the bleeding regardless of the redesign.
2. **Unified home:** converge the two home routes; "You" node + urgency
   reordering; calm auto-reveal.
3. **Onboarding:** remove the fork; merge intros; move pairing in.
4. **Settings collapse:** two role-aware family sections; visibility under
   follower row.
5. **Spec reconciliation:** amend D8a + data-model doc; mark `account_type`
   inert.

## Alternatives considered

- **Keep the binary, just wire the missing invite step** (Sprint 19's
  implicit path). Rejected: fixes the dead-end but still cannot show "me +
  my parents," and preserves the support-ticket account-switch from D8a
  §14.1. Treats the symptom, not the model.
- **Merge Mum + Dad into one container** (founder's scenario-1 instinct).
  Rejected: breaks the one-wearer-per-circle safety invariant — two
  people's BP in one bucket means the system can't answer "whose reading
  is this?". Fixed instead with language + flow, not structure.
- **Make `account_type` truly mutable / migrate personas.** Rejected:
  fights a `NOT NULL` immutable column the whole codebase and D8a depend
  on; far larger blast radius than making it inert.
- **A "graduate from self-buyer to caregiver" upgrade flow.** Rejected as
  unnecessary: if the home is unified from day one, there is no
  graduation — adding a person is just tapping "+ Add someone." (Founder
  agreed to hold this.)

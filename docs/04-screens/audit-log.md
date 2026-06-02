# Screen — Activity log

Sourced from D6 US-82 ("I can see who's accessed my data and when"). The read-only viewer of the user's own account activity, surfaced from Settings → Privacy and data. Implementation at `apps/mobile/src/screens/AuditLog/AuditLogScreen.tsx`.

> **Reached from**: Settings → Privacy and data → "Activity log" (`navigation` row). See `docs/04-screens/settings.md` §"Privacy and data section".

---

## Audience

Both personas. The screen is scoped to the signed-in user's own actions — it reads `public.audit_log` rows where `actor_user_id = auth.uid()`, permitted by the `"self reads own audit"` RLS policy (`docs/01-data-model.md`, `public.audit_log`). It does NOT surface the owner-reads-family-audit view; this is strictly self-read.

## Purpose

- Give the user transparency over activity on their own account: who viewed a reading, subscription changes, exports, deletion requests.
- Satisfy D6 US-82 without exposing raw machine action codes or any reading values.

---

## Data source

A single Supabase query against `public.audit_log`, run on mount (and on retry):

- Columns selected: `id, occurred_at, action, metadata`.
- Filter: `actor_user_id = <session user id>`.
- Window: `occurred_at >= now() − 90 days` (the hot-retention window per `docs/01-data-model.md` retention table: "90 days hot, 7 years archive").
- Order: `occurred_at` descending (newest first).
- Limit: 200 rows.

When there is no session user id, the screen renders the empty state without querying.

> **No reading values appear here.** The query never selects BP/HR/SpO2 values; rows describe *that* a reading was viewed, never the numbers. This matches the data rule in CLAUDE.md (reading values never leave their own surfaces) and the analytics rule in `docs/10-anomaly-logic.md` §3.3.

---

## Layout

A single `ScrollView` inside a `SafeAreaView` (`surface.warmBase` background, top + bottom safe-area edges).

1. **Back affordance** — a text "Back" pressable (`brand.primary`), top-left, calls `navigation.goBack()`.
2. **Header** — "Activity" (`displayM`, `text.primary`, `accessibilityRole="header"`).
3. **Subtitle** — "The last 90 days of activity on your account." (`bodyL`, `text.secondary`).
4. **Body** — one of four mutually exclusive states (see below).

Each activity entry renders as a `ListRow` (`variant="data"`) with:
- **title** = the plain-language label for the action (see Action labels).
- **subtitle** = the formatted timestamp.
- a divider on every row except the last.

---

## States

| State | Trigger | Visual |
| --- | --- | --- |
| `loading` | `entries === null` (query in flight) | Centered "Loading…" in `text.tertiary` |
| `error` | The Supabase query returned an error | Centered "We couldn't load your activity log. Pull down to retry." in `text.secondary` |
| `empty` | Query returned zero rows | Centered "Nothing here yet. Activity will appear as it happens." in `text.tertiary` |
| `populated` | One or more rows | A list of `ListRow` entries, newest first |

> **Note**: the error copy invites "Pull down to retry", but the current implementation does not wire a `RefreshControl` onto the `ScrollView`. The retry path is `fetchEntries`, which re-runs on mount. Pull-to-refresh is not yet attached — treat the copy as aspirational until that wiring lands.

---

## Action labels

Raw action codes from `audit_log.action` are translated to plain-language sentences by an in-file `ACTION_LABELS` map. The raw string stays behind the wall; the user reads the sentence. Current map:

| `action` code | Displayed label |
| --- | --- |
| `reading.read` | A reading was viewed |
| `subscription.activated` | Leiko Plus started |
| `subscription.renewed` | Leiko Plus renewed |
| `subscription.lapsed` | Leiko Plus ended |
| `subscription.event_replayed` | Subscription event replayed |
| `sync.invalid_sample` | A reading was rejected |
| `family.role_change` | A family role changed |
| `data.export_started` | Data export started |
| `data.export_completed` | Data export completed |
| `account.delete_requested` | Account deletion requested |

Any unmapped action code falls through to the raw string (`actionToLabel` returns `action` itself). New audit actions should get a label added here so a raw code never reaches the user.

> `metadata` is selected from the query but is not currently rendered — labels are derived from `action` alone.

---

## Timestamp format

`formatTime(occurred_at)` renders `"<Mon D> · <h:mm>"` (e.g. "Jun 2 · 7:42 AM") using the **device locale** (`toLocaleDateString` / `toLocaleTimeString` with `undefined` locale). Per the in-file Sprint 16.5i note, this replaced a hardcoded `'en-US'` so en-NG users get conventions that match their region — Leiko ships in Nigeria and the US.

---

## Voice

Per `docs/05-voice-and-claims.md`:
- **Header + subtitle** are calm, plain noun phrases — "Activity", "The last 90 days of activity on your account."
- **Empty state** follows the empty-state rule (explain what *will* happen, never "empty"/"none"): "Nothing here yet. Activity will appear as it happens."
- **Error state** names a friendly cause + a fix, no stack trace or error code: "We couldn't load your activity log. Pull down to retry."
- **Action labels** avoid clinical and machine language. No reading values, no "patient", no fear language.

---

## Accessibility

- Header carries `accessibilityRole="header"`.
- Back control is `accessibilityRole="button"`, `accessibilityLabel="Back"`, with a hit slop of `spacing.m`.
- Each entry is a `ListRow` (its own roles/labels come from that component).

---

## Anti-patterns

- **No reading values** in any row — the screen describes access events, never the numbers (CLAUDE.md data rule).
- **No raw action codes** shown to the user when a label exists — keep `ACTION_LABELS` current.
- **No count badges / "new" dots** on rows (CLAUDE.md anti-pattern).

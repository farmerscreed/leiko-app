# ADR-0003: PostgreSQL pin — 15 → 17

- **Status**: Accepted
- **Date**: 2026-05-05
- **Sprint**: 0 (bootstrap, Session 0b)
- **Supersedes**: original PostgreSQL 15 pin in `docs/00-tech-stack.md`

## Context

`docs/00-tech-stack.md` originally pinned **PostgreSQL 15**. That pin was correct when written: PG 15 was the most common Supabase Cloud version.

By 2026-05-05:
- **PostgreSQL 15** — supported, but EOL November 2027 (~18 months away).
- **PostgreSQL 17** — Supabase Cloud's default for new projects since late 2025, supported through November 2029. The `supabase init` CLI scaffolds `config.toml` with `major_version = 17`.

CLAUDE.md states: *"Versions are pinned in `docs/00-tech-stack.md`. If a `package.json` version doesn't match, that's a bug. Don't bump."* It also requires deviations to be documented as ADRs (D7 §15).

## Decision

**Pin PostgreSQL to 17.x.** `supabase/config.toml` `db.major_version = 17` (Supabase CLI default — no override needed).

## Rationale

1. **Launch coverage.** Sprint 17 (App Store / Play Store submission) lands in late-2026 to early-2027. PG 15's EOL is November 2027 — uncomfortably close. PG 17 supports through November 2029.
2. **Same rationale as the original pin.** PG 15 was chosen as "what Supabase Cloud uses". PG 17 is now what Supabase Cloud uses for new projects.
3. **Schema compatibility.** The Sprint 0 schema uses no PG-15-or-17-specific features. Verified against `docs/01-data-model.md`: `gen_random_uuid()` (PG 13+ core), `gen_random_bytes()` (pgcrypto), partitioned tables (PG 10+), enum types, `jsonb`, `inet`. All work on PG 15 and PG 17.
4. **No-friction default.** Supabase CLI defaults to 17. Pinning to 15 would require an explicit override, and the local Docker image would need to be the older one.

## Consequences

- `supabase/config.toml` `db.major_version = 17` (CLI default — left untouched).
- `docs/00-tech-stack.md` Backend table updated.
- All migrations target PG 17. If we ever support a PG-15-pinned customer in a partner deployment, we keep the migrations PG-15-compatible by avoiding PG-17-only features (none used as of Sprint 0).

## Alternatives considered

- **Stay on PG 15.** Rejected: requires explicit override of Supabase CLI defaults, and EOL is too close to the launch window.
- **Move to PG 16.** Rejected: still in support but Supabase has already moved its default to 17. Splitting the difference adds friction with no benefit.

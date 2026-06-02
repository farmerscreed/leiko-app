-- 0024_caregiver_relationship_label.sql — Sprint 19 Block 5.
--
-- Adds a per-caregiver label for the wearer. Background: a self-buyer
-- who invites a caregiver leaks the literal string 'self' into the
-- caregiver's view (the value lives on `families.parent_relationship`
-- as a self-buyer-onboarding marker). From the caregiver's perspective
-- the wearer isn't 'self', they're "Mum", "Husband", "Friend" — and
-- a single value on `families` can't serve multiple caregivers who'd
-- each label the wearer differently.
--
-- Design:
--   * Optional `caregiver_relationship_label text` on family_members.
--     Nullable; falls back to families.parent_relationship for display.
--   * Storage convention matches families.parent_relationship:
--     plain string for known relationships ('mother', 'daughter',
--     etc.) OR 'other:<label>' for custom. Block 1's display-side
--     `formatRelation` already handles the 'self' fallback; this
--     column's value takes precedence when present.
--   * No length constraint at the DB level (matches the schema's
--     treatment of `parent_display_name`); the client trims + caps
--     at submit time. Server validation can be added later if needed.
--
-- RLS unchanged: family_members SELECT + UPDATE policies already
-- restrict access to members of the family / family_owners. The
-- column inherits the same row-level gating.
--
-- The accept-family-invite Edge Function (Block 5b) writes this on
-- the upsert; the AcceptInviteSheet (Block 5c) prompts for it.

alter table public.family_members
  add column if not exists caregiver_relationship_label text;

comment on column public.family_members.caregiver_relationship_label is
  'Sprint 19. Optional per-caregiver label for the wearer (e.g. ''mother'', ''daughter'', or ''other:<label>''). When NULL the display layer falls back to families.parent_relationship via formatRelation.';

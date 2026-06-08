-- 0045_studio_briefs.sql
--
-- The Leiko Studio's dynamic brief library. The 23 hard-coded kit prompts are a
-- starter accelerator; this table makes the Create panel self-sustaining: the
-- founder can save/upload their own briefs, and the agent can propose new ones
-- from the Operator's data ("research") or the weekly strategist's creative
-- ideas. Saved briefs show up in the Create panel picker alongside the kit.
-- Service-role only (RLS on, no policies), same pattern as the other studio_* /
-- ops_* tables.

create table public.studio_briefs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  source      text not null default 'founder',  -- founder | ai | operator
  title       text,
  angle       text,
  format      text check (format in ('1x1', '4x5', '9x16')),
  prompt      text not null,                     -- the full, ready-to-send prompt
  caption     text,
  cta         text,
  status      text not null default 'active' check (status in ('active', 'archived'))
);

create index studio_briefs_created_idx on public.studio_briefs (created_at desc);

alter table public.studio_briefs enable row level security;

comment on table public.studio_briefs is
  'Leiko Studio: dynamic brief library (founder-saved, AI-suggested, or Operator-fed). Service-role only.';

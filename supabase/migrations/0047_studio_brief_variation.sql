-- 0047_studio_brief_variation.sql
--
-- The winner→variations loop (Studio S5.2b). When an ad performs well, the agent
-- proposes variation briefs derived from it; this column links each such brief
-- back to the winning asset it riffs on. When the founder generates from the
-- brief, the new asset inherits variation_of = this winner, so lineage is kept.

alter table public.studio_briefs
  add column if not exists variation_of uuid references public.studio_assets (id) on delete set null;

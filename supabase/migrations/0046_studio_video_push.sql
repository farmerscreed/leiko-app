-- 0046_studio_video_push.sql
--
-- Support pushing VIDEO creatives to Meta (Studio S5.3). A video ad needs the
-- uploaded Meta video id, and Meta processes the video asynchronously after
-- upload — so we add a 'pushing' status (video uploaded, awaiting Meta's
-- "ready" before the ad creative can be made) and a meta_video_id column.

alter table public.studio_assets add column if not exists meta_video_id text;

alter table public.studio_assets drop constraint if exists studio_assets_status_check;
alter table public.studio_assets add constraint studio_assets_status_check
  check (status in (
    'generating', 'generated', 'brand_flagged',
    'approved', 'rejected', 'pushing', 'pushed', 'failed'
  ));

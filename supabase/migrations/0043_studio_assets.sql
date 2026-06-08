-- 0043_studio_assets.sql
--
-- The Leiko Studio's metadata store. Files (generated images/videos and the
-- founder's real watch reference photos) live in the Cloudflare R2 bucket
-- `leiko-studio`; these tables hold the metadata + pipeline state. Service-role
-- only (RLS on, no policies) — the worker reaches them with the service key,
-- same pattern as the ops_* tables.
--
-- Video-ready from day one (kind, format 9x16) even though S1 ships images.
-- The pipeline status walks: generating → generated → brand_flagged? →
-- approved | rejected → pushed (to a PAUSED Meta ad). See docs/studio/SPEC.md §3.

-- The founder's real watch photos, uploaded once. AI builds product-consistent
-- shots on top of these (image-to-image) and recolors straps white↔black.
create table public.studio_references (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  label       text,
  strap_color text,                      -- 'white' | 'black'
  r2_key      text not null              -- references/<id>.<ext> in R2
);

create table public.studio_assets (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  kind            text not null default 'image'
                    check (kind in ('image', 'video')),
  angle           text,                  -- creative angle (from the prompt kit)
  format          text
                    check (format in ('1x1', '4x5', '9x16')),
  prompt          text,                  -- the final composed prompt sent to fal
  reference_id    uuid references public.studio_references (id) on delete set null,
  fal_model       text,
  fal_request_id  text,
  r2_key          text,                  -- assets/<id>.<ext> in R2
  width           int,
  height          int,
  status          text not null default 'generating'
                    check (status in (
                      'generating', 'generated', 'brand_flagged',
                      'approved', 'rejected', 'pushed', 'failed'
                    )),
  brand_check     jsonb,                 -- { pass: bool, issues: [...] }
  caption         text,
  cta             text,
  meta_image_hash text,
  meta_creative_id text,
  meta_ad_id      text,
  variation_of    uuid references public.studio_assets (id) on delete set null,
  notes           text
);

create index studio_assets_created_idx on public.studio_assets (created_at desc);
create index studio_assets_status_idx  on public.studio_assets (status);

alter table public.studio_references enable row level security;
alter table public.studio_assets     enable row level security;

comment on table public.studio_references is
  'Leiko Studio: founder real watch photos anchoring product-consistent shots. Files in R2 leiko-studio/references/. Service-role only.';
comment on table public.studio_assets is
  'Leiko Studio: generated ad assets + pipeline state. Files in R2 leiko-studio/assets/. Service-role only.';

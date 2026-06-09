-- 0050_enable_pg_net.sql — enable the HTTP extension the crons depend on.
--
-- Every cron invoker (0013/0015/0018/0023 + 0048/0049) calls
-- `net.http_post(...)` to hit an Edge Function. But pg_net was never
-- actually installed on this project — only supabase_vault + pg_cron were.
-- So the `net` schema didn't exist and every scheduled cron silently
-- errored with `42P01/3F000: schema "net" does not exist` at fire time.
-- This enables pg_net (idempotent), creating the `net` schema + http_post.
--
-- Belongs logically before 0013, but migrations are append-only and the
-- invoker functions only resolve `net` at CALL time (cron fire), not at
-- definition time — so enabling it now fixes every existing cron too.

create extension if not exists pg_net;

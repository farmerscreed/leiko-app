-- 0027_devices_client_device_id.sql
--
-- Stable device identity to stop duplicate device rows.
--
-- The Urion U16 firmware advertises a ROTATING BLE MAC: reconnecting or
-- re-pairing the same physical watch surfaces a different mac_address
-- (observed: CA:BF:55:1F:01:3C -> CA:BF:55:1F:32:7B after a reconnect).
-- ensureDeviceRow() keyed device identity on mac_address, so each new MAC
-- minted a brand-new devices row with a fresh per-device sync cursor. The
-- new identity then backfilled days the watch had already purged as 0,
-- creating duplicate steps_day / calories_day rows that shadowed the real
-- history under a different device_id.
--
-- Fix: the client now generates a stable per-install UUID
-- (getOrCreateClientDeviceId, persisted in MMKV) and sends it on every
-- sync. The edge function keys identity on this value; mac_address becomes
-- informational (refreshed to the latest MAC each sync). This column
-- stores that stable id.
--
-- Nullable + backfilled lazily: existing rows stay NULL until the next
-- sync from an updated client, at which point ensureDeviceRow adopts the
-- family's single active device and stamps the id onto it (one watch per
-- family). Older clients that don't send the id keep working via the
-- legacy MAC match.

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS client_device_id text;

-- One active device per (family, stable id). Partial on unpaired_at IS
-- NULL to mirror devices_active_mac, and on client_device_id IS NOT NULL
-- so the not-yet-migrated rows (all NULL) don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS devices_active_client_id
  ON public.devices (family_id, client_device_id)
  WHERE unpaired_at IS NULL AND client_device_id IS NOT NULL;

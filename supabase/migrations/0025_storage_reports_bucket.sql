-- 0025_storage_reports_bucket.sql — Sprint 19 follow-up (2026-05-24).
--
-- Creates the `reports` Storage bucket that generate-doctor-pdf uploads
-- to. Without this bucket the function rasterizes the PDF successfully
-- via PDFShift, then 500s on the upload step with
-- "StorageApiError: Bucket not found". Surfaced on Phone 1 right after
-- the PDFShift X-API-Key adapter fix (f93ce3b) unblocked the rasterize
-- path.
--
-- Bucket policy:
--   - Private (public = false). PDFs contain caregiver-readable BP /
--     HR / SpO2 / sleep / activity series — strictly not for the open
--     web. Mobile clients access via short-TTL signed URLs returned
--     by generate-doctor-pdf.
--   - Path convention: `${familyId}/leiko_report_${range}_${ts}.pdf`
--     enforced by index.ts uploadAndSign(). Path prefix is the family
--     UUID so admin/inspection tooling can scope to one family at a
--     time without scanning the whole bucket.
--
-- RLS policies: none added here.
--   - Uploads come from the Edge Function via the service-role client
--     — bypasses RLS.
--   - Downloads use signed URLs minted by the same Edge Function — no
--     authenticated read needed; the signed token is the credential.
--   If a future surface needs `from('reports').download(path)` with a
--   user JWT, add explicit policies then.

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

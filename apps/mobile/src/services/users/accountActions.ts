// Account-level actions invoked from Settings → Privacy. Sprint 10b.3.
//
// Centralises the Edge Function calls so the screen stays a thin
// caller. Both endpoints require the user's auth header — supabase-js
// attaches it automatically when we use the SDK's `functions.invoke`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { Share } from 'react-native';
import { supabase as defaultSupabase } from '../supabase';
import { logger } from '../analytics/logger';
import type { Database } from '../../types/database';

interface ExportResult {
  rowCount: number;
}

/**
 * Triggers /export-data, then opens the native Share sheet so the
 * user can save / email / AirDrop the CSV. Returns the row count for
 * the toast.
 */
export async function exportFamilyData(
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<ExportResult> {
  logger.track('data_export_started');
  const { data, error } = await client.functions.invoke<{
    csv: string;
    rowCount: number;
  }>('export-data', { body: {} });
  if (error) {
    logger.track('data_export_failed', { reason: error.message });
    throw error;
  }
  if (!data?.csv) {
    const reason = 'no_csv_returned';
    logger.track('data_export_failed', { reason });
    throw new Error(reason);
  }
  // RN's Share API accepts a `message` (text) — the CSV travels as the
  // body of an email / message / clipboard. Native files would need a
  // tmp-file write via expo-file-system; deferring that polish to a
  // follow-up because the Share-as-text path covers email/AirDrop
  // round-trips on both platforms.
  await Share.share({
    title: 'Leiko data export',
    message: data.csv,
  });
  logger.track('data_export_completed', { rowCount: data.rowCount });
  return { rowCount: data.rowCount };
}

/**
 * Soft-delete the caller's account. Returns the timestamp the row was
 * marked deleted at. Caller is responsible for signing out + routing
 * to the unauthenticated stack.
 */
export async function deleteAccount(
  confirmEmail: string,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<{ deletedAt: string }> {
  logger.track('account_delete_requested', { confirmed: true });
  const { data, error } = await client.functions.invoke<{ deletedAt: string }>(
    'delete-account',
    { body: { confirmEmail } },
  );
  if (error) {
    logger.track('account_delete_failed', { reason: error.message });
    throw error;
  }
  if (!data?.deletedAt) {
    throw new Error('delete_failed');
  }
  return { deletedAt: data.deletedAt };
}

import type { BackfillStatus } from './backfill';

/** Status line under "Copy past readings". Counts only, no values. */
export function backfillCaption(
  status: BackfillStatus,
  copied: number,
  lastCompletedAt: number | null,
): string {
  if (status === 'running') {
    return copied > 0 ? `Copying… ${copied.toLocaleString()} so far` : 'Copying…';
  }
  if (status === 'failed') return "That didn't finish. Tap to try again.";
  if (lastCompletedAt) {
    return `Last copied ${new Date(lastCompletedAt).toLocaleDateString()}. Tap to copy again.`;
  }
  return 'Sends your earlier readings to Health Connect.';
}

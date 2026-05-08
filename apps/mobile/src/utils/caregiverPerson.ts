// CaregiverPerson — Sprint 7.7a (caregiver Family Constellation).
//
// Pure derivation: takes a ParentSummary + the person's slot index in
// the family list (rotating accent palette) + a `now` timestamp, and
// returns the shape the bird's-eye view consumes (PersonOrb + legend).
//
// Status taxonomy maps to the existing classifier + staleness:
//   clear     ← classifyReading(latest BP) → 'in_pattern' AND fresh (≤12h)
//   attention ← classifyReading(latest BP) → 'calm_concerned'
//   urgent    ← classifyReading(latest BP) → 'confirmed_urgent'
//   offline   ← latest BP measured > 12h ago (D13 §6 stale threshold for BP)
//   watch     ← Sprint 15 deferral (3-day BP trend up). v1 treats as `clear`;
//               type space is preserved so 7.7b/15 can flip without code
//               surgery elsewhere.
//   sleeping  ← Sprint 8.5+ deferral (active sleep session within last 4h).
//               Cross-phone caregivers don't have the OWNING phone's sleep
//               state in v1; never returned by this helper. The type space
//               accepts 'sleeping' so test fixtures can simulate it.
//
// Headline is a deterministic placeholder until Sprint 12.5 wires AI
// narration. Calm, factual, voice-rule-clean. The legend renders this
// truncated to one line.

import type { ParentSummary } from '../services/families/fetchParentSummaries';
import type { Status } from '../components/StatusPill';
import { classifyReading } from './classification';

const BP_STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12h per D13 §6
const MIN_PER_HR = 60;

export type CaregiverAccentSlot = 1 | 2 | 3;

export interface CaregiverPerson {
  /** Family id — opaque identifier. */
  id: string;
  /** Full display name as the parent profile carries it. */
  fullName: string;
  /** First letter, uppercased; '·' if name is empty. */
  initial: string;
  /** Slot in the rotating per-person palette (1..3). Consumer maps to
   *  `theme.colors.person[slot]`. */
  accentIndex: CaregiverAccentSlot;
  status: Status;
  /** Pre-formatted BP, e.g. "122/78" or "—" when no reading exists. */
  bpLabel: string;
  /** Calm, factual one-line headline. Placeholder until Sprint 12.5 AI. */
  headline: string;
  /** Display string for the relationship column ("Mom" / "Dad" / "Aunt"). */
  relation: string;
}

export function caregiverPersonFromParent(
  parent: ParentSummary,
  indexInList: number,
  nowMs: number = Date.now(),
): CaregiverPerson {
  const accentIndex = (((indexInList % 3) + 1) as CaregiverAccentSlot);
  const trimmedName = parent.parentDisplayName.trim();
  const initial = trimmedName.length > 0 ? trimmedName[0].toUpperCase() : '·';

  let status: Status = 'clear';
  let bpLabel = '—';
  let headline = 'No readings yet';

  const r = parent.latestReading;
  if (r) {
    const measuredAtMs = Date.parse(r.measuredAt);
    const ageMs = Math.max(0, nowMs - measuredAtMs);
    bpLabel = `${r.systolic}/${r.diastolic}`;

    if (ageMs > BP_STALE_THRESHOLD_MS) {
      status = 'offline';
      headline = `Last reading ${humanizeAge(ageMs)} ago`;
    } else {
      const tier = classifyReading(
        { systolic: r.systolic, diastolic: r.diastolic, pulse: r.pulse },
        null,
      ).tier;
      switch (tier) {
        case 'confirmed_urgent':
          status = 'urgent';
          headline = 'A calm check-in helps right now.';
          break;
        case 'calm_concerned':
          status = 'attention';
          headline = "Worth a chat — pattern's a little off.";
          break;
        case 'in_pattern':
          status = 'clear';
          headline = `Read ${humanizeAge(ageMs)} ago — in pattern.`;
          break;
      }
    }
  }

  return {
    id: parent.familyId,
    fullName: trimmedName.length > 0 ? trimmedName : 'Family member',
    initial,
    accentIndex,
    status,
    bpLabel,
    headline,
    relation: parent.parentRelationship || 'Family',
  };
}

export function caregiverPeopleFromParents(
  parents: ParentSummary[],
  nowMs: number = Date.now(),
): CaregiverPerson[] {
  return parents.map((p, i) => caregiverPersonFromParent(p, i, nowMs));
}

// Shared helper for human-readable age, used by the headline fallbacks.
function humanizeAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < MIN_PER_HR) return `${minutes} min`;
  const hours = Math.floor(minutes / MIN_PER_HR);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

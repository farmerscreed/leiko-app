// constellationNodes — ADR-0006 Phase 2.
//
// Bridges the existing data layer (ParentSummary[] from useFamilyReadings)
// to the unified home's ordered ConstellationNode[]. The viewer's own
// self-circle already arrives in `parents` (its parent_relationship is
// 'self', set by create_family on the self_buyer path), so no new data
// plumbing is needed — we just (a) flag which node is the viewer's own,
// and (b) order them by urgency (constellationOrder).
//
// Pure + unit-tested so the riskier UI shell sits on verified logic.

import type { ParentSummary } from '../services/families/fetchParentSummaries';
import { caregiverPersonFromParent } from './caregiverPerson';
import {
  orderConstellationNodes,
  type ConstellationNode,
} from './constellationOrder';

// A circle is the VIEWER'S OWN self-circle only when BOTH hold:
//   • its parent_relationship is 'self' (create_family's self_buyer stamp), AND
//   • the viewer is the family_owner of it (their own circle, not one they
//     merely follow).
//
// The relationship alone is NOT enough: EVERY self-buyer's circle has
// relationship 'self', so a caregiver following several wearers would see
// all of them as "self" and they'd collapse into the centre "You" node
// (observed: a caregiver phone showed only one wearer, the rest vanished
// from the orbit). viewerRole disambiguates — in circles you follow your
// role is 'caregiver', not 'family_owner'.
export function isSelfCircle(parent: ParentSummary): boolean {
  return (
    parent.parentRelationship.trim().toLowerCase() === 'self' &&
    parent.viewerRole === 'family_owner'
  );
}

/**
 * Build the ordered constellation nodes for the unified home.
 *
 * - Each ParentSummary → a CaregiverPerson node (reusing the existing
 *   pure derivation), with `isSelf` flagged for the viewer's own circle.
 * - Ordered by constellationOrder (urgency first, else self first).
 *
 * accentIndex from caregiverPersonFromParent rotates 1..3 by list index;
 * the self node keeps whatever slot it lands in — the views give "You"
 * its distinct treatment via `isSelf`, not via accent.
 */
export function buildConstellationNodes(
  parents: ParentSummary[],
  nowMs: number = Date.now(),
): ConstellationNode[] {
  const nodes: ConstellationNode[] = parents.map((parent, index) => ({
    ...caregiverPersonFromParent(parent, index, nowMs),
    isSelf: isSelfCircle(parent),
  }));
  return orderConstellationNodes(nodes);
}

/** Does the viewer wear their own watch (have a self-circle among nodes)?
 *  Drives whether the home shows a "You" node + the personal affordances. */
export function hasSelfNode(nodes: ConstellationNode[]): boolean {
  return nodes.some((n) => n.isSelf);
}

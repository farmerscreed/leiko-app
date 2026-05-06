// Onboarding store — Sprint 3.
//
// Holds the in-flight caregiver onboarding draft (caregiver name + pronoun,
// parent name + relationship + timezone) and exposes the action that
// finalises onboarding by:
//
//   1. Updating public.users.display_name + timezone (the placeholders
//      stamped by handle_new_user are replaced with the user's real input).
//   2. Calling the create_family RPC (SECURITY DEFINER, see migration
//      0003_create_family_rpc.sql) which atomically writes the families
//      row, the family_owner row, and an audit_log entry.
//   3. Persisting family_id + caregiverOnboardingComplete to MMKV so the
//      navigator routes the user out of the onboarding stack.
//
// Why MMKV mirroring: the navigator needs a synchronous read at startup
// (before the Supabase session has hydrated) to decide whether to show the
// onboarding stack. The Zustand state is the runtime source of truth; MMKV
// is the persistent fallback that hydrate() reads on cold start.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { supabase } from '../services/supabase';
import { useAuth } from './auth';

export type CaregiverRelationship =
  | 'daughter'
  | 'son'
  | 'niece'
  | 'nephew'
  | 'other';

export type ParentRelationship =
  | 'mother'
  | 'father'
  | 'aunt'
  | 'uncle'
  | 'other';

export interface CaregiverDraft {
  displayName: string;
  relationship: CaregiverRelationship | null;
}

export interface ParentDraft {
  displayName: string;
  relationship: ParentRelationship | null;
  relationshipCustom: string | null;     // when relationship === 'other'
  timezone: string;                      // IANA, e.g. 'America/New_York'
}

interface OnboardingState {
  // Draft (cleared after successful completion).
  caregiver: CaregiverDraft;
  parent: ParentDraft;

  // Persisted across launches (mirrors MMKV).
  familyId: string | null;
  caregiverOnboardingComplete: boolean;

  // In-flight call state for FamilyWatch's "I have the watch" CTA.
  finalizing: boolean;
  finalizeError: string | null;

  setCaregiver: (patch: Partial<CaregiverDraft>) => void;
  setParent: (patch: Partial<ParentDraft>) => void;
  resetDraft: () => void;
  hydrate: () => void;
  completeWithWatchInHand: () => Promise<void>;
}

function readBool(key: string): boolean {
  return mmkv.getBoolean(key) === true;
}

function emptyCaregiver(): CaregiverDraft {
  return { displayName: '', relationship: null };
}

function emptyParent(): ParentDraft {
  return {
    displayName: '',
    relationship: null,
    relationshipCustom: null,
    timezone: defaultTimezone(),
  };
}

function defaultTimezone(): string {
  // Intl.DateTimeFormat is available in Hermes / JSC; the timezone picker
  // on FamilyParent overrides this if the user's chosen parent lives in a
  // different region.
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Resolve the parent_relationship string we send to create_family. For
// 'other' with a custom label, encode as 'other:<label>' per the data
// model convention (see public.families.parent_relationship comment in
// docs/01-data-model.md).
function encodeParentRelationship(p: ParentDraft): string {
  if (p.relationship === 'other') {
    const label = (p.relationshipCustom ?? '').trim();
    return label.length > 0 ? `other:${label}` : 'other';
  }
  return p.relationship ?? '';
}

export const useOnboarding = create<OnboardingState>((set, get) => ({
  caregiver: emptyCaregiver(),
  parent: emptyParent(),
  familyId: mmkv.getString(STORAGE_KEYS.currentFamilyId) ?? null,
  caregiverOnboardingComplete: readBool(STORAGE_KEYS.caregiverOnboardingComplete),
  finalizing: false,
  finalizeError: null,

  setCaregiver(patch) {
    set((s) => ({ caregiver: { ...s.caregiver, ...patch } }));
  },

  setParent(patch) {
    set((s) => ({ parent: { ...s.parent, ...patch } }));
  },

  resetDraft() {
    set({
      caregiver: emptyCaregiver(),
      parent: emptyParent(),
      finalizeError: null,
    });
  },

  hydrate() {
    set({
      familyId: mmkv.getString(STORAGE_KEYS.currentFamilyId) ?? null,
      caregiverOnboardingComplete: readBool(STORAGE_KEYS.caregiverOnboardingComplete),
    });
  },

  async completeWithWatchInHand() {
    const { caregiver, parent } = get();
    const profile = useAuth.getState().profile;

    if (!profile) {
      throw new Error('Not signed in. Sign in and try again.');
    }
    if (!caregiver.displayName.trim() || !caregiver.relationship) {
      throw new Error('Caregiver profile is incomplete.');
    }
    if (!parent.displayName.trim() || !parent.relationship) {
      throw new Error('Parent profile is incomplete.');
    }

    set({ finalizing: true, finalizeError: null });

    try {
      // 1. Replace the placeholder display_name + timezone stamped by
      //    handle_new_user with the caregiver's real input. The caregiver's
      //    own timezone defaults to the device's; the parent's timezone is
      //    captured in families.parent_residence work in a later sprint.
      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: caregiver.displayName.trim(),
          timezone: parent.timezone || defaultTimezone(),
        })
        .eq('id', profile.id);
      if (updateError) throw updateError;

      // 2. Atomic family + family_member + audit_log via the RPC.
      const { data, error: rpcError } = await supabase.rpc('create_family', {
        _parent_display_name: parent.displayName.trim(),
        _parent_relationship: encodeParentRelationship(parent),
        _caregiver_relationship: caregiver.relationship,
      });
      if (rpcError) throw rpcError;

      const familyId = Array.isArray(data) ? data[0]?.family_id : null;
      if (!familyId) {
        throw new Error('create_family returned no family_id');
      }

      // 3. Persist + flip the navigator gate.
      mmkv.set(STORAGE_KEYS.currentFamilyId, familyId);
      mmkv.set(STORAGE_KEYS.caregiverOnboardingComplete, true);

      set({
        familyId,
        caregiverOnboardingComplete: true,
        caregiver: emptyCaregiver(),
        parent: emptyParent(),
        finalizing: false,
      });
    } catch (e) {
      // Supabase surfaces typed PostgrestError / AuthError objects with a
      // .message field rather than Error instances; check both shapes.
      const message =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string'
            ? (e as { message: string }).message
            : "We couldn't finish setup. Try again.";
      set({ finalizing: false, finalizeError: message });
      throw e;
    }
  },
}));

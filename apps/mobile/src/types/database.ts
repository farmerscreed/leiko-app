// Hand-written subset of the public schema we actually query from the app.
// The full generated `Database` type lands when we wire `supabase gen types
// typescript` in a later sprint; until then we type-check just what code
// touches today.
//
// Source of truth: supabase/migrations/0001_initial.sql, updated by
// 0002_account_type_immutable.sql.

// Type aliases (not `interface`) so the Row / Insert / Update shapes
// structurally satisfy postgrest-js's GenericSchema constraint
// (Record<string, unknown>). Interfaces don't carry an implicit
// index signature, so the schema defaults to `any` and `update()` /
// `rpc()` resolve to `never` — see node_modules/@supabase/postgrest-js
// for the GenericTable definition.

export type AccountType = 'caregiver' | 'parent' | 'self_buyer';

export type FamilyRole = 'family_owner' | 'caregiver' | 'parent_owner' | 'parent_viewer';

export type SubscriptionStatus =
  | 'free'
  | 'plus'
  | 'plus_trial'
  | 'plus_grace'
  | 'past_due';

export type UserRow = {
  id: string;
  email: string | null;
  display_name: string;
  photo_url: string | null;
  preferred_language: string;
  timezone: string;
  year_of_birth: number | null;
  account_type: AccountType;
  marketing_opt_in: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserUpdate = {
  display_name?: string;
  photo_url?: string | null;
  preferred_language?: string;
  timezone?: string;
  year_of_birth?: number | null;
  marketing_opt_in?: boolean;
};

export type FamilyRow = {
  id: string;
  parent_user_id: string | null;
  parent_display_name: string;
  parent_relationship: string;
  parent_year_of_birth: number | null;
  parent_residence: string | null;
  subscription_status: SubscriptionStatus;
  subscription_renewal_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type FamilyMemberRow = {
  family_id: string;
  user_id: string;
  role: FamilyRole;
  invited_by: string | null;
  joined_at: string;
  removed_at: string | null;
  removed_reason: string | null;
};

export type QualityScore = 'good' | 'fair' | 'suspect';

export type ReadingSource = 'watch' | 'manual' | 'clinic' | 'pharmacy' | 'other';

export type ReadingRow = {
  id: string;
  family_id: string;
  device_id: string | null;
  source: ReadingSource;
  measured_at: string;
  measured_at_local: string | null;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  quality_score: QualityScore | null;
  quality_flags: Record<string, unknown>;
  motion_detected: boolean | null;
  hidden: boolean;
  hidden_reason: string | null;
  hidden_by_user_id: string | null;
  hidden_at: string | null;
  created_at: string;
};

export type CreateFamilyArgs = {
  _parent_display_name: string;
  _parent_relationship: string;
  _caregiver_relationship: string;
};

// Multi-vitals (Sprint 7.5) — table is keyed by (family_id, vital_type,
// measured_at). Sprint 7.7b is the first client-side reader; the writes
// flow through the /sync Edge Function (services/sync/postMultiVitals.ts).
//
// Encoding per docs/_reference/D13-multi-vitals-constellation-spec.md
// + supabase/functions/_shared/vital-row-mappers.ts:
//   hr            → value_int = bpm; value_jsonb = { motion_state, ... }
//   spo2          → value_int = avg %; value_int_2 = max; value_int_3 = min
//   sleep_session → value_int = totalMinutes; value_int_2 = deepMinutes;
//                   value_int_3 = lightMinutes
//   steps_day     → value_int = total_steps; value_jsonb.day_local
//   calories_day  → value_int = total_kcal; value_int_2 = activity;
//                   value_int_3 = bmr
export type VitalType = 'hr' | 'spo2' | 'sleep_session' | 'steps_day' | 'calories_day';

export type VitalsOtherRow = {
  id: string;
  family_id: string;
  device_id: string | null;
  vital_type: VitalType;
  measured_at: string;
  value_int: number | null;
  value_int_2: number | null;
  value_int_3: number | null;
  value_jsonb: Record<string, unknown> | null;
  hidden: boolean;
  hidden_reason: string | null;
  created_at: string;
};

// Shape conforms to @supabase/postgrest-js's GenericSchema constraint
// (Tables / Views / Functions, with Relationships on each table). Without
// Views + Relationships the postgrest-js client falls back to `any`-typed
// builders, and `update()` resolves to `never` instead of the row's
// Update type. See node_modules/@supabase/postgrest-js/src/types/common/common.ts.
export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: UserRow;
        Update: UserUpdate;
        Relationships: [];
      };
      families: {
        Row: FamilyRow;
        // Inserts go through the create_family RPC (SECURITY DEFINER);
        // RLS forbids direct client inserts.
        Insert: FamilyRow;
        Update: Partial<FamilyRow>;
        Relationships: [];
      };
      family_members: {
        Row: FamilyMemberRow;
        Insert: FamilyMemberRow;
        Update: Partial<FamilyMemberRow>;
        Relationships: [];
      };
      readings: {
        Row: ReadingRow;
        Insert: Omit<ReadingRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ReadingRow>;
        Relationships: [];
      };
      vitals_other: {
        Row: VitalsOtherRow;
        // Inserts go through the /sync Edge Function (service_role). RLS
        // forbids direct client inserts; this Insert type exists only so
        // the postgrest-js builder typecheck doesn't fall back to never.
        Insert: Omit<VitalsOtherRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<VitalsOtherRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_family: {
        Args: CreateFamilyArgs;
        Returns: { family_id: string }[];
      };
    };
  };
};

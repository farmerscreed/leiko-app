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

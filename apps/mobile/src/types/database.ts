// Hand-written subset of the public.users row shape for Sprint 2. The full
// generated `Database` type lands when we wire `supabase gen types
// typescript` in a later sprint; until then we type-check just what auth
// actually queries (the user profile read after sign-in).
//
// Source of truth: supabase/migrations/0001_initial.sql `public.users`,
// updated by 0002_account_type_immutable.sql.

export type AccountType = 'caregiver' | 'parent' | 'self_buyer';

export interface UserRow {
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
}

export interface UserUpdate {
  display_name?: string;
  photo_url?: string | null;
  preferred_language?: string;
  timezone?: string;
  year_of_birth?: number | null;
  marketing_opt_in?: boolean;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: never;
        Update: UserUpdate;
      };
    };
  };
}

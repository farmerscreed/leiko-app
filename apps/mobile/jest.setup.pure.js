/* global process */
// Pure-project setup: env-var defaults so modules that touch
// services/supabase don't throw at module load. The actual Supabase
// client isn't exercised in pure tests — postReading is always mocked
// where it's called — but the supabase module's load-time guard runs
// regardless of whether it's used.

process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

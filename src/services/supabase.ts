import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One lazily created Supabase client shared by the auth and DB adapters, so
 * they use the same session (and the SDK stays code-split out of the main
 * bundle). Only public values are used: the project URL and the anon key from
 * VITE_* env vars. A failed load (e.g. offline chunk fetch) can be retried.
 */
export function createSupabaseLoader(supabaseUrl: string, anonKey: string): () => Promise<SupabaseClient> {
  let clientPromise: Promise<SupabaseClient> | null = null;
  return () => {
    if (!clientPromise) {
      clientPromise = import('@supabase/supabase-js')
        .then(({ createClient }) =>
          createClient(supabaseUrl, anonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
          }),
        )
        .catch((err: unknown) => {
          clientPromise = null;
          throw err;
        });
    }
    return clientPromise;
  };
}

import { NotConfiguredError, type DbService } from '../types';

/**
 * Live DB adapter (Supabase Postgres behind RLS). Stub: throws until the
 * Supabase client and table schema are in place.
 */
export function createLiveDb(supabaseUrl: string, anonKey: string): DbService {
  void supabaseUrl;
  void anonKey;
  const notReady = (): never => {
    throw new NotConfiguredError('DB', 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (client not implemented)');
  };
  return {
    getProfile: async () => notReady(),
    upsertProfile: async () => notReady(),
    listEntries: async () => notReady(),
    addToList: async () => notReady(),
    removeFromList: async () => notReady(),
    getProgress: async () => notReady(),
    setProgress: async () => notReady(),
  };
}

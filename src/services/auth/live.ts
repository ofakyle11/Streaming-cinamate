import { NotConfiguredError, type AuthService } from '../types';

/**
 * Live auth adapter (Supabase Auth). Stub: throws until the Supabase client is
 * wired in. Only the public anon key + URL may ever reach the client bundle.
 */
export function createLiveAuth(supabaseUrl: string, anonKey: string): AuthService {
  void supabaseUrl;
  void anonKey;
  const notReady = (): never => {
    throw new NotConfiguredError('Auth', 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (client not implemented)');
  };
  return {
    currentUser: async () => notReady(),
    signInWithEmail: async () => notReady(),
    signUpWithEmail: async () => notReady(),
    signInWithMagicLink: async () => notReady(),
    signOut: async () => notReady(),
    onAuthStateChange: () => notReady(),
  };
}

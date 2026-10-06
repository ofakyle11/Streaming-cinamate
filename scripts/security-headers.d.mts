export const TURNSTILE_ORIGIN: string;
export interface CspOptions {
  turnstile?: boolean;
  /** VITE_SUPABASE_URL; connect-src is pinned to this origin (none when unset). */
  supabaseUrl?: string;
}
export function supabaseOrigins(url?: string): string[];
export function cspOptions(env?: Record<string, string | undefined>): Required<CspOptions>;
export function cspDirectives(opts?: CspOptions): Record<string, string[]>;
export function buildCsp(opts?: CspOptions): string;
export function turnstileEnabled(env?: Record<string, string | undefined>): boolean;
export function headersFile(opts?: CspOptions): string;
export function securityHeadersPlugin(): import('vite').Plugin;

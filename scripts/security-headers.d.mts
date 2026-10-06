export const TURNSTILE_ORIGIN: string;
export interface CspOptions {
  turnstile?: boolean;
}
export function cspDirectives(opts?: CspOptions): Record<string, string[]>;
export function buildCsp(opts?: CspOptions): string;
export function turnstileEnabled(env?: Record<string, string | undefined>): boolean;
export function headersFile(opts?: CspOptions): string;
export function securityHeadersPlugin(): import('vite').Plugin;

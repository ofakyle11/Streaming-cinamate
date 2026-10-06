import { describe, expect, it } from 'vitest';
import { readCallbackError } from './callbackError';

describe('readCallbackError', () => {
  it('is null for a token hash or an empty URL', () => {
    expect(readCallbackError('', '')).toBeNull();
    expect(readCallbackError('', '#access_token=abc&refresh_token=def&type=magiclink')).toBeNull();
    expect(readCallbackError('?code=pkce-code', '')).toBeNull();
  });

  it('reads an expired link from the hash (implicit flow)', () => {
    expect(
      readCallbackError(
        '',
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toBe('expired');
  });

  it('reads an expired link from the query (PKCE flow)', () => {
    expect(readCallbackError('?error=access_denied&error_code=otp_expired', '')).toBe('expired');
    expect(
      readCallbackError('?error=server_error&error_description=Token%20has%20expired', ''),
    ).toBe('expired');
  });

  it('reports any other error as a bad link', () => {
    expect(readCallbackError('', '#error=access_denied&error_code=bad_oauth_state')).toBe('link');
    expect(readCallbackError('?error=invalid_request', '')).toBe('link');
  });
});

import { describe, expect, it } from 'vitest';
import { relativeSeen } from './relativeSeen';

const now = Date.parse('2026-10-06T12:00:00Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('relativeSeen', () => {
  it('labels recent activity', () => {
    expect(relativeSeen(ago(0), now)).toBe('active now');
    expect(relativeSeen(ago(90_000), now)).toBe('active now');
    expect(relativeSeen(ago(5 * 60_000), now)).toBe('5 minutes ago');
    expect(relativeSeen(ago(60 * 60_000), now)).toBe('1 hour ago');
    expect(relativeSeen(ago(3 * 3600_000), now)).toBe('3 hours ago');
    expect(relativeSeen(ago(26 * 3600_000), now)).toBe('yesterday');
    expect(relativeSeen(ago(3 * 86400_000), now)).toBe('3 days ago');
  });
  it('falls back to a date, and to nothing for garbage', () => {
    expect(relativeSeen(ago(30 * 86400_000), now)).toMatch(/Sep/);
    expect(relativeSeen('nope', now)).toBe('');
  });
});

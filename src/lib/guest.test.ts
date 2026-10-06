import { describe, expect, it } from 'vitest';
import { GUEST_KEY, forgetGuest, hasChosenGuest, rememberGuest } from './guest';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('guest choice', () => {
  it('is not chosen by default', () => {
    expect(hasChosenGuest(memoryStorage())).toBe(false);
  });

  it('remembers and forgets the choice', () => {
    const store = memoryStorage();
    rememberGuest(store);
    expect(store.getItem(GUEST_KEY)).toBe('1');
    expect(hasChosenGuest(store)).toBe(true);
    forgetGuest(store);
    expect(hasChosenGuest(store)).toBe(false);
  });

  it('survives blocked storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => rememberGuest(blocked)).not.toThrow();
    expect(hasChosenGuest(blocked)).toBe(false);
    expect(hasChosenGuest(null)).toBe(false);
  });
});

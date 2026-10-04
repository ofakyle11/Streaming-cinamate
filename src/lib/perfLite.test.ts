import { describe, expect, it } from 'vitest';
import { applyPerfLite, shouldUsePerfLite } from './perfLite';

describe('perf-lite', () => {
  it('is off on a normal device', () => {
    expect(shouldUsePerfLite({ deviceMemory: 8, connection: { saveData: false } })).toBe(false);
    expect(shouldUsePerfLite({})).toBe(false);
  });
  it('turns on for low memory or data saver', () => {
    expect(shouldUsePerfLite({ deviceMemory: 2 })).toBe(true);
    expect(shouldUsePerfLite({ connection: { saveData: true } })).toBe(true);
  });
  it('adds the class to <html> only when it applies', () => {
    document.documentElement.classList.remove('perf-lite');
    applyPerfLite(document, { deviceMemory: 8 });
    expect(document.documentElement.classList.contains('perf-lite')).toBe(false);
    applyPerfLite(document, { deviceMemory: 2 });
    expect(document.documentElement.classList.contains('perf-lite')).toBe(true);
    document.documentElement.classList.remove('perf-lite');
  });
});

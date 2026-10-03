export interface PerfHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** Devices that should skip blur and ambient light: low memory or data saver. */
export function shouldUsePerfLite(nav: PerfHints = navigator as PerfHints): boolean {
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4;
  const saveData = nav.connection?.saveData === true;
  return lowMemory || saveData;
}

/** Adds `perf-lite` to <html> when the device qualifies (surfaces.css reads it). */
export function applyPerfLite(
  doc: Document = document,
  nav: PerfHints = navigator as PerfHints,
): void {
  if (shouldUsePerfLite(nav)) doc.documentElement.classList.add('perf-lite');
}

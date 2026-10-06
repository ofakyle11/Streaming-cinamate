/** "active now", "3 hours ago", "yesterday", "12 Sep" for the devices list. */
export function relativeSeen(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60_000);
  if (min < 2) return 'active now';
  if (min < 60) return `${min} minutes ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

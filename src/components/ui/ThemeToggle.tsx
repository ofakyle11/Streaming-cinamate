import { KeyboardEvent, useId, useRef, useState } from 'react';
import { useTheme } from '../../theme/useTheme';
import { THEME_PREFERENCES, type ThemePreference } from '../../theme/theme';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import '../../styles/theme-toggle.css';

export interface ThemeToggleProps {
  /** Accessible name of the group. */
  label?: string;
  className?: string;
}

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; icon: string }> = [
  { value: 'system', label: 'System', icon: '◐' },
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '☾' },
];

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

/**
 * Switches the theme behind a view transition that grows the new theme as a
 * circle from the pressed option (600ms, --ease-enter). Falls back to a plain
 * swap where the API is missing or motion is reduced.
 */
function switchWithTransition(apply: () => void, origin: HTMLElement | null, reduced: boolean) {
  const doc = document as ViewTransitionDocument;
  if (reduced || typeof doc.startViewTransition !== 'function' || !origin) {
    apply();
    return;
  }
  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  const transition = doc.startViewTransition(apply);
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 600,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {
      /* the transition was skipped; the theme is already applied */
    });
}

/**
 * System / Light / Dark as a radio group. Arrow keys move between the options
 * and select them (roving tabindex, wraps at the ends), Home/End jump, the
 * change is announced politely and focus stays where it was.
 */
export default function ThemeToggle({ label = 'Theme', className }: ThemeToggleProps) {
  const { preference, setTheme } = useTheme();
  const reduced = usePrefersReducedMotion();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const [announcement, setAnnouncement] = useState('');
  const liveId = useId();

  const choose = (next: ThemePreference, focusIndex?: number) => {
    const origin = buttons.current[THEME_PREFERENCES.indexOf(next)];
    if (focusIndex !== undefined) buttons.current[focusIndex]?.focus();
    if (next === preference) return;
    switchWithTransition(() => setTheme(next), origin ?? null, reduced);
    const name = OPTIONS.find((o) => o.value === next)?.label ?? next;
    setAnnouncement(next === 'system' ? 'Theme follows your device' : `${name} theme on`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const last = OPTIONS.length - 1;
    let target: number;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        target = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        target = index === 0 ? last : index - 1;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = last;
        break;
      default:
        return;
    }
    e.preventDefault();
    choose(OPTIONS[target].value, target);
  };

  const checkedIndex = Math.max(
    0,
    OPTIONS.findIndex((o) => o.value === preference),
  );

  return (
    <div className={cx('theme-toggle', className)}>
      <div className="theme-toggle-group" role="radiogroup" aria-label={label}>
        {OPTIONS.map((opt, i) => {
          const checked = i === checkedIndex;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className={cx('theme-toggle-option', checked && 'is-checked')}
              data-theme-option={opt.value}
              onClick={() => choose(opt.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className="theme-toggle-icon" aria-hidden="true">
                {opt.icon}
              </span>
              <span className="theme-toggle-label">{opt.label}</span>
            </button>
          );
        })}
      </div>
      <span id={liveId} className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

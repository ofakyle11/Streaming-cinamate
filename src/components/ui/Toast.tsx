import {
  createContext,
  FocusEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Button from './Button';
import IconButton from './IconButton';
import '../../styles/toast.css';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastOptions {
  kind?: ToastKind;
  /** ms before auto-dismiss; 0 keeps it until closed. Default 4000. */
  duration?: number;
  /** Optional inline action (e.g. Undo). Clicking it runs `onAction` and dismisses the toast. */
  action?: ToastAction;
}

export interface ToastAction {
  label: string;
  onAction: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  leaving: boolean;
  action?: ToastAction;
}

interface ToastApi {
  toast: (message: string, opts?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

type PauseReason = 'hover' | 'focus' | 'hidden';

/** Auto-dismiss bookkeeping for one toast. */
interface DismissTimer {
  handle: ReturnType<typeof setTimeout> | null;
  /** ms left before auto-dismiss (updated whenever the timer is paused). */
  remaining: number;
  /** Date.now() when the running timer was (re)started. */
  startedAt: number;
  reasons: Set<PauseReason>;
}

const ToastContext = createContext<ToastApi | null>(null);

const LEAVE_MS = 300;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function documentHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  /** Auto-dismiss timers (pausable). */
  const timers = useRef(new Map<number, DismissTimer>());
  /** Exit-animation timers (not pausable). */
  const leaveTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const clearTimers = (id: number) => {
    const t = timers.current.get(id);
    if (t?.handle) clearTimeout(t.handle);
    timers.current.delete(id);
    const l = leaveTimers.current.get(id);
    if (l) clearTimeout(l);
    leaveTimers.current.delete(id);
  };

  const remove = useCallback((id: number) => {
    clearTimers(id);
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      if (prefersReducedMotion()) return remove(id);
      clearTimers(id);
      setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      leaveTimers.current.set(
        id,
        setTimeout(() => remove(id), LEAVE_MS),
      );
    },
    [remove],
  );

  const start = useCallback(
    (id: number, t: DismissTimer) => {
      t.startedAt = Date.now();
      t.handle = setTimeout(() => dismiss(id), Math.max(0, t.remaining));
    },
    [dismiss],
  );

  const pause = useCallback((id: number, reason: PauseReason) => {
    const t = timers.current.get(id);
    if (!t) return;
    t.reasons.add(reason);
    if (t.handle) {
      clearTimeout(t.handle);
      t.handle = null;
      t.remaining -= Date.now() - t.startedAt;
    }
  }, []);

  const resume = useCallback(
    (id: number, reason: PauseReason) => {
      const t = timers.current.get(id);
      if (!t) return;
      t.reasons.delete(reason);
      if (t.reasons.size === 0 && !t.handle) start(id, t);
    },
    [start],
  );

  const toast = useCallback(
    (message: string, opts: ToastOptions = {}) => {
      const id = nextId.current++;
      const duration = opts.duration ?? 4000;
      setItems((list) => [...list, { id, message, kind: opts.kind ?? 'info', leaving: false, action: opts.action }]);
      if (duration > 0) {
        const t: DismissTimer = {
          handle: null,
          remaining: duration,
          startedAt: 0,
          reasons: new Set(),
        };
        timers.current.set(id, t);
        if (documentHidden()) t.reasons.add('hidden');
        else start(id, t);
      }
      return id;
    },
    [start],
  );

  // Pause every auto-dismiss timer while the tab is hidden.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      const hidden = documentHidden();
      Array.from(timers.current.keys()).forEach((id) =>
        hidden ? pause(id, 'hidden') : resume(id, 'hidden'),
      );
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause, resume]);

  useEffect(() => {
    const map = timers.current;
    const leaving = leaveTimers.current;
    return () => {
      map.forEach((t) => t.handle && clearTimeout(t.handle));
      leaving.forEach((t) => clearTimeout(t));
    };
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  const renderItem = (t: ToastItem) => (
    <div
      key={t.id}
      className={`toast glass ${t.kind}${t.leaving ? ' leaving' : ''}`}
      onMouseEnter={() => pause(t.id, 'hover')}
      onMouseLeave={() => resume(t.id, 'hover')}
      onFocus={() => pause(t.id, 'focus')}
      onBlur={(e: FocusEvent<HTMLDivElement>) => {
        if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
        resume(t.id, 'focus');
      }}
    >
      <span className="toast-msg">{t.message}</span>
      {t.action && (
        <Button
          variant="ghost"
          size="sm"
          className="toast-action"
          onClick={() => {
            t.action?.onAction();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </Button>
      )}
      <IconButton label="Dismiss" size="sm" glass={false} onClick={() => dismiss(t.id)}>
        ✕
      </IconButton>
    </div>
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        {/* Both live regions stay mounted so screen readers pick up insertions. */}
        <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
          {items.filter((t) => t.kind !== 'error').map(renderItem)}
        </div>
        <div className="toast-stack" role="alert" aria-live="assertive" aria-atomic="false">
          {items.filter((t) => t.kind === 'error').map(renderItem)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const NOOP_TOAST: ToastApi = { toast: () => 0, dismiss: () => {} };

/** Like useToast, but a no-op outside <ToastProvider> (for components that also render in isolation). */
export function useOptionalToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP_TOAST;
}

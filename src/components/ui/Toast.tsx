import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Button from './Button';
import IconButton from './IconButton';

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

const ToastContext = createContext<ToastApi | null>(null);

const LEAVE_MS = 300;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const clearTimer = (id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  };

  const remove = useCallback((id: number) => {
    clearTimer(id);
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      if (prefersReducedMotion()) return remove(id);
      clearTimer(id);
      setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      timers.current.set(id, setTimeout(() => remove(id), LEAVE_MS));
    },
    [remove],
  );

  const toast = useCallback(
    (message: string, opts: ToastOptions = {}) => {
      const id = nextId.current++;
      const duration = opts.duration ?? 4000;
      setItems((list) => [...list, { id, message, kind: opts.kind ?? 'info', leaving: false, action: opts.action }]);
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast glass ${t.kind}${t.leaving ? ' leaving' : ''}`} role="status">
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
        ))}
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

"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ToastVariant = "success" | "error" | "warning";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4500;

const variantStyles: Record<ToastVariant, { icon: LucideIcon; classes: string }> = {
  success: { icon: CheckCircle2, classes: "text-emerald-900 [&_svg]:text-emerald-700" },
  error: { icon: AlertTriangle, classes: "text-rose-900 [&_svg]:text-rose-700" },
  warning: { icon: AlertTriangle, classes: "text-amber-900 [&_svg]:text-amber-700" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((current) => [...current, { id, message, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      );
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => push(message, "success"),
      error: (message: string) => push(message, "error"),
      warning: (message: string) => push(message, "warning"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:items-end sm:px-4">
        {toasts.map((toast) => {
          const { icon: Icon, classes } = variantStyles[toast.variant];
          return (
            <div
              key={toast.id}
              className={`glass-panel animate-enter pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-2xl p-3.5 text-sm font-semibold shadow-lg ${classes}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="min-w-0 flex-1 leading-5">{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:text-slate-600"
                aria-label="Fechar aviso"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast precisa estar dentro de ToastProvider");
  }

  return context;
}

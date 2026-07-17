"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type ConfirmState = ConfirmOptions & { id: string };

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ id: `confirm-${Date.now()}`, ...options });
    });
  }, []);

  function close(result: boolean) {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/40 backdrop-blur-sm sm:items-center"
          onClick={() => close(false)}
        >
          <div className="mobile-sheet animate-enter" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  state.tone === "danger" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"
                }`}
              >
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-950">{state.title}</h2>
                {state.description && <p className="mt-1 text-sm leading-5 text-slate-500">{state.description}</p>}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => close(false)} className="min-h-12 rounded-lg bg-slate-100 text-sm font-bold text-slate-700">
                {state.cancelLabel ?? "Cancelar"}
              </button>
              <button
                onClick={() => close(true)}
                className={`min-h-12 rounded-lg text-sm font-bold text-white ${
                  state.tone === "danger" ? "bg-rose-700" : "bg-emerald-900"
                }`}
              >
                {state.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error("useConfirm precisa estar dentro de ConfirmProvider");
  }

  return context;
}

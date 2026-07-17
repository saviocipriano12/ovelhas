"use client";

import { useEffect, useState } from "react";
import { CloudOff, Download, RefreshCw, Wifi } from "lucide-react";
import { processOfflineQueue, useOfflineQueue } from "@/lib/offline-queue";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { pendingCount, refreshQueue } = useOfflineQueue();

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }

    function handleOffline() {
      setOnline(false);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!online || pendingCount === 0) {
      return;
    }

    queueMicrotask(() => setSyncing(true));
    processOfflineQueue()
      .then(() => refreshQueue())
      .finally(() => queueMicrotask(() => setSyncing(false)));
  }, [online, pendingCount, refreshQueue]);

  async function install() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (online && pendingCount === 0 && (!installPrompt || installDismissed)) {
    return null;
  }

  const onlyInstall = online && pendingCount === 0 && installPrompt;

  return (
    <div className={`fixed inset-x-3 bottom-[calc(6.2rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-xl lg:bottom-5 lg:left-auto lg:right-5 lg:mx-0 lg:w-96 ${onlyInstall ? "hidden sm:block" : ""}`}>
      <div className="rounded-[20px] border border-white/80 bg-white/95 p-3 shadow-2xl shadow-slate-900/15 backdrop-blur-xl">
        {!online && (
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 text-amber-950">
            <CloudOff size={20} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold">Voce esta offline</p>
              <p className="text-xs leading-5 text-amber-800">O Ovelhas vai manter a fila local e sincronizar depois.</p>
            </div>
          </div>
        )}

        {online && pendingCount > 0 && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 p-3 text-emerald-950 first:mt-0">
            <div className="flex min-w-0 items-center gap-3">
              {syncing ? <RefreshCw size={20} className="shrink-0 animate-spin" /> : <Wifi size={20} className="shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm font-bold">{pendingCount} item(ns) para sincronizar</p>
                <p className="text-xs leading-5 text-emerald-800">Relatorios, supervisoes, agenda, oracao e outros registros offline serao enviados automaticamente.</p>
              </div>
            </div>
          </div>
        )}

        {installPrompt && !installDismissed && (
          <div className="mt-2 flex items-center gap-2 first:mt-0">
            <button
              onClick={install}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white"
            >
              <Download size={18} />
              Instalar Ovelhas
            </button>
            <button
              onClick={() => setInstallDismissed(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
              aria-label="Dispensar instalacao"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

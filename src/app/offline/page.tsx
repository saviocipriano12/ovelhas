"use client";

import Link from "next/link";
import { CloudOff, Home, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#f7f8f3] px-4 py-6 text-slate-900">
      <section className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md flex-col justify-center">
        <div className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-100 text-emerald-950">
            <CloudOff size={28} />
          </div>
          <p className="mt-6 text-sm font-bold uppercase text-emerald-200">Modo offline</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">Sem internet agora, mas o cuidado continua.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Algumas telas recentes ainda podem abrir. Presencas salvas offline ficam na fila do aparelho para sincronizar depois.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link href="/dashboard" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white">
            <Home size={18} />
            Inicio
          </Link>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"
          >
            <RefreshCw size={18} />
            Tentar
          </button>
        </div>
      </section>
    </main>
  );
}

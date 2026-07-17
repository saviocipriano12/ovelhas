"use client";

import { useState } from "react";
import { Copy, QrCode, Share2, UserCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { getScopedCells } from "@/lib/access-control";
import { createCheckInCode, qrCodeUrl } from "@/lib/checkin";
import { roleLabels } from "@/lib/data";
import { useCells, useCheckIns } from "@/lib/local-store";

function publicUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export default function CheckInPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { checkIns } = useCheckIns(currentUser.churchId);
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const [selectedCellId, setSelectedCellId] = useState(visibleCells[0]?.id ?? "");
  const [type, setType] = useState<"cell" | "service">("cell");
  const selectedCell = visibleCells.find((cell) => cell.id === selectedCellId) ?? visibleCells[0];
  const code = selectedCell ? createCheckInCode(selectedCell.id, type) : "";
  const link = code ? publicUrl(`/checkin/${code}`) : "";
  const today = new Date().toISOString().slice(0, 10);
  const todayCheckIns = checkIns.filter(
    (checkin) => checkin.cellId === selectedCell?.id && checkin.checkinDate === today && checkin.checkinType === type,
  );

  async function copyLink() {
    await navigator.clipboard?.writeText(link);
  }

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({ title: "Check-in Ovelhas", text: "Confirme sua presença no Ovelhas", url: link });
    } else {
      await copyLink();
    }
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader eyebrow={roleLabels[currentUser.role]} title="Check-in por QR" />

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Gerar" title="QR da reunião" />
            <div className="space-y-3">
              <select value={selectedCell?.id ?? ""} onChange={(event) => setSelectedCellId(event.target.value)} className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                {visibleCells.map((cell) => (
                  <option key={cell.id} value={cell.id}>{cell.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                <button onClick={() => setType("cell")} className={`min-h-10 rounded-lg text-sm font-bold ${type === "cell" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500"}`}>Celula</button>
                <button onClick={() => setType("service")} className={`min-h-10 rounded-lg text-sm font-bold ${type === "service" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500"}`}>Culto</button>
              </div>
            </div>

            <div className="mt-5 rounded-[22px] bg-slate-950 p-5 text-center text-white">
              {link ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCodeUrl(link)} alt="QR Code do check-in" className="mx-auto h-64 w-64 rounded-lg bg-white p-3" />
              ) : (
                <div className="flex h-64 items-center justify-center rounded-lg bg-white/10">
                  <QrCode size={64} className="text-white/40" />
                </div>
              )}
              <p className="mt-4 text-sm font-bold text-emerald-200">{selectedCell?.name}</p>
              <p className="mt-1 break-all text-xs text-slate-300">{code}</p>
              <p className="mt-2 text-xs font-semibold text-amber-200">Valido so para hoje. Gere um novo QR no proximo encontro.</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={copyLink} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-700 shadow-sm">
                <Copy size={18} />
                Copiar
              </button>
              <button onClick={shareLink} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white">
                <Share2 size={18} />
                Compartilhar
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader
              eyebrow="Hoje"
              title="Presenças por check-in"
              action={<span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{todayCheckIns.length}</span>}
            />
            <div className="space-y-3">
              {todayCheckIns.map((checkin) => (
                <article key={checkin.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                    <UserCheck size={18} />
                  </span>
                  <span>
                    <span className="block font-bold text-slate-950">{checkin.personName}</span>
                    <span className="text-sm text-slate-500">{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(checkin.createdAt))}</span>
                  </span>
                </article>
              ))}
              {todayCheckIns.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">Nenhum check-in registrado ainda.</p>}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}

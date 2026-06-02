"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Download,
  FileText,
  MessageSquareText,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { getScopedActivityEvents, getScopedCells, getScopedPeople } from "@/lib/access-control";
import { roleLabels } from "@/lib/data";
import {
  useActivityEvents,
  useCells,
  useChurchSettings,
  useLocalPeople,
  usePrayerRequests,
} from "@/lib/local-store";

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function SettingsPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { settings, updateSettings } = useChurchSettings(currentUser.churchId);
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { events } = useActivityEvents();
  const { requests } = usePrayerRequests();
  const [feedback, setFeedback] = useState("");
  const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visibleEvents = getScopedActivityEvents(currentUser, events, cells, people, isDemoMode);
  const canManage = currentUser.role === "admin" || currentUser.role === "pastor";
  const exportSummary = useMemo(
    () => ({
      church: settings.churchName,
      exportedAt: new Date().toISOString(),
      people: visiblePeople.length,
      cells: visibleCells.length,
      activities: visibleEvents.length,
      prayerRequests: requests.length,
    }),
    [requests.length, settings.churchName, visibleCells.length, visibleEvents.length, visiblePeople.length],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      setFeedback("Apenas administrador ou pastor podem alterar configuracoes da igreja.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const result = await updateSettings({
      churchName: String(formData.get("churchName") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      state: String(formData.get("state") || "").trim(),
      logoUrl: String(formData.get("logoUrl") || "").trim(),
      primaryColor: String(formData.get("primaryColor") || "#064e3b").trim(),
      welcomeMessage: String(formData.get("welcomeMessage") || "").trim(),
      absenceMessage: String(formData.get("absenceMessage") || "").trim(),
      discipleshipMessage: String(formData.get("discipleshipMessage") || "").trim(),
      privacyContact: String(formData.get("privacyContact") || "").trim(),
      termsText: String(formData.get("termsText") || "").trim(),
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setFeedback(`Nao consegui salvar: ${result.error}`);
      return;
    }

    setFeedback("Configuracoes salvas.");
  }

  function exportJson() {
    downloadFile(
      `ovelhas-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ settings, people: visiblePeople, cells: visibleCells, activities: visibleEvents, prayerRequests: requests }, null, 2),
      "application/json;charset=utf-8",
    );
  }

  function exportPeopleCsv() {
    const header = ["nome", "telefone", "email", "celula", "lider", "status", "etapa", "bairro"];
    const rows = visiblePeople.map((person) =>
      [person.name, person.phone, person.email, person.cell, person.leader, person.status, person.stage, person.neighborhood]
        .map(csvEscape)
        .join(","),
    );
    downloadFile(`ovelhas-pessoas-${new Date().toISOString().slice(0, 10)}.csv`, [header.join(","), ...rows].join("\n"), "text/csv;charset=utf-8");
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader eyebrow={roleLabels[currentUser.role]} title="Configuracoes da igreja" />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <SlidersHorizontal size={20} className="text-emerald-200" />
            <p className="mt-3 text-2xl font-semibold">{visiblePeople.length}</p>
            <p className="text-sm text-slate-300">Pessoas visiveis</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <ShieldCheck size={20} className="text-emerald-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{visibleCells.length}</p>
            <p className="text-sm text-slate-500">Celulas</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <ClipboardCheck size={20} className="text-sky-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{visibleEvents.length}</p>
            <p className="text-sm text-slate-500">Auditoria</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <FileText size={20} className="text-amber-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{requests.length}</p>
            <p className="text-sm text-slate-500">Pedidos</p>
          </div>
        </div>

        {feedback && <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{feedback}</div>}

        <section className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-800">
              <ShieldCheck size={18} />
            </span>
            <div>
              <p className="text-sm font-black uppercase text-emerald-800">Igreja atual isolada</p>
              <h3 className="mt-1 text-lg font-black text-emerald-950">{settings.churchName}</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-emerald-900">
                Tudo que for criado neste acesso usa o identificador desta igreja. Convites, celulas, pessoas, relatorios, videos e consolidacao ficam separados das outras igrejas.
              </p>
              <p className="mt-2 break-all rounded-2xl bg-white/75 p-3 text-xs font-bold text-emerald-900">
                ID da igreja: {currentUser.churchId}
              </p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm sm:p-5">
          <SectionHeader eyebrow="Identidade" title="Marca e dados da igreja" />
          <div className="grid gap-3 md:grid-cols-2">
            <input name="churchName" defaultValue={settings.churchName} disabled={!canManage} className="field-control disabled:bg-slate-50" placeholder="Nome da igreja" />
            <input name="logoUrl" defaultValue={settings.logoUrl} disabled={!canManage} className="field-control disabled:bg-slate-50" placeholder="URL do logo" />
            <input name="city" defaultValue={settings.city} disabled={!canManage} className="field-control disabled:bg-slate-50" placeholder="Cidade" />
            <input name="state" defaultValue={settings.state} disabled={!canManage} className="field-control disabled:bg-slate-50" placeholder="Estado" />
            <label className="flex min-h-14 items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
              <Palette size={18} className="text-emerald-700" />
              <input name="primaryColor" type="color" defaultValue={settings.primaryColor} disabled={!canManage} className="h-8 w-12 bg-transparent" />
              Cor principal
            </label>
          </div>

          <div className="mt-6">
            <SectionHeader eyebrow="Mensagens" title="Modelos para WhatsApp" />
            <div className="grid gap-3">
              <textarea name="welcomeMessage" defaultValue={settings.welcomeMessage} disabled={!canManage} rows={3} className="field-control min-h-28 resize-none disabled:bg-slate-50" />
              <textarea name="absenceMessage" defaultValue={settings.absenceMessage} disabled={!canManage} rows={3} className="field-control min-h-28 resize-none disabled:bg-slate-50" />
              <textarea name="discipleshipMessage" defaultValue={settings.discipleshipMessage} disabled={!canManage} rows={3} className="field-control min-h-28 resize-none disabled:bg-slate-50" />
            </div>
          </div>

          <div className="mt-6">
            <SectionHeader eyebrow="LGPD" title="Privacidade e termos" />
            <div className="grid gap-3">
              <input name="privacyContact" defaultValue={settings.privacyContact} disabled={!canManage} className="field-control disabled:bg-slate-50" placeholder="Responsavel pelo contato de privacidade" />
              <textarea name="termsText" defaultValue={settings.termsText} disabled={!canManage} rows={4} className="field-control min-h-32 resize-none disabled:bg-slate-50" />
            </div>
          </div>

          {canManage && (
            <button className="primary-action mt-4">
              <MessageSquareText size={18} />
              Salvar configuracoes
            </button>
          )}
        </form>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Dados" title="Exportacao e backup" />
            <div className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <p className="font-bold text-slate-950">Resumo do pacote</p>
              <p>{exportSummary.people} pessoas, {exportSummary.cells} celulas, {exportSummary.activities} atividades.</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={exportJson} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white">
                <Download size={18} />
                Backup JSON
              </button>
              <button onClick={exportPeopleCsv} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-slate-700 shadow-sm">
                <Download size={18} />
                Pessoas CSV
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Auditoria" title="Ultimos movimentos" />
            <div className="space-y-3">
              {visibleEvents.slice(0, 6).map((event) => (
                <article key={event.id} className="rounded-lg bg-slate-50 p-4">
                  <p className="font-bold text-slate-950">{event.action}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{event.description}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">{event.actorName} - {new Intl.DateTimeFormat("pt-BR").format(new Date(event.createdAt))}</p>
                </article>
              ))}
              {visibleEvents.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">Nenhum movimento registrado ainda.</p>}
            </div>
          </div>
        </section>
      </section>
    </AppShell>
  );
}

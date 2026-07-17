"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  CreditCard,
  Download,
  FileText,
  ImageUp,
  Loader2,
  MessageSquareText,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { getScopedActivityEvents, getScopedCells, getScopedPeople } from "@/lib/access-control";
import { roleLabels } from "@/lib/data";
import {
  useActivityEvents,
  useCells,
  useChurchSettings,
  useChurchSubscription,
  useLocalPeople,
  usePrayerRequests,
} from "@/lib/local-store";
import { SUBSCRIPTION_PLANS, isSubscriptionBlocked, type SubscriptionTier } from "@/lib/subscription-plans";
import { supabase } from "@/lib/supabase/client";

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trialing: "Em teste gratis",
  active: "Ativa",
  past_due: "Pagamento atrasado",
  canceled: "Cancelada",
  incomplete: "Aguardando pagamento",
  incomplete_expired: "Expirada sem pagamento",
  unpaid: "Nao paga",
  lifetime: "Cortesia (acesso vitalicio)",
};

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
  const { subscription } = useChurchSubscription(currentUser.churchId);
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { events } = useActivityEvents();
  const { requests } = usePrayerRequests();
  const toast = useToast();
  const [logoPreview, setLogoPreview] = useState(settings.logoUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visibleEvents = getScopedActivityEvents(currentUser, events, cells, people, isDemoMode);
  const canManage = currentUser.role === "admin" || currentUser.role === "pastor";

  useEffect(() => {
    queueMicrotask(() => {
      setLogoPreview(settings.logoUrl);
    });
  }, [settings.logoUrl]);

  async function handleLogoFile(file?: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem para o logo.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Use uma imagem menor que 5 MB.");
      return;
    }

    if (isDemoMode) {
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(String(reader.result || ""));
      reader.readAsDataURL(file);
      return;
    }

    setUploadingLogo(true);
    const extension = file.name.split(".").pop() || "png";
    const path = `${currentUser.churchId}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("church-logos").upload(path, file, { upsert: true });
    setUploadingLogo(false);

    if (uploadError) {
      toast.error(`Nao consegui enviar o logo: ${uploadError.message}`);
      return;
    }

    const { data } = supabase.storage.from("church-logos").getPublicUrl(path);
    setLogoPreview(data.publicUrl);
    toast.success("Logo carregado. Clique em salvar para confirmar.");
  }
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
      toast.error("Apenas administrador ou pastor podem alterar configuracoes da igreja.");
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
      toast.error(`Nao consegui salvar: ${result.error}`);
      return;
    }

    toast.success("Configuracoes salvas.");
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

        {canManage && !isDemoMode && (
          <Link
            href="/assinatura"
            className="flex items-center gap-3 rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm transition hover:border-emerald-200"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
              <CreditCard size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black uppercase text-slate-400">Assinatura</p>
              <p className="mt-1 text-base font-black text-slate-950">
                {subscription
                  ? SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status
                  : "Sem assinatura"}
                {subscription?.tier ? ` - Plano ${SUBSCRIPTION_PLANS[subscription.tier as SubscriptionTier].label}` : ""}
              </p>
              {isSubscriptionBlocked(subscription?.status) && (
                <p className="mt-1 text-xs font-bold text-rose-700">Acesso bloqueado - regularize para liberar a igreja.</p>
              )}
            </div>
            <span className="shrink-0 text-xs font-black text-emerald-800">Gerenciar</span>
          </Link>
        )}

        <form onSubmit={handleSubmit} className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm sm:p-5">
          <SectionHeader eyebrow="Identidade" title="Marca e dados da igreja" />
          <div className="grid gap-3 md:grid-cols-2">
            <input name="churchName" defaultValue={settings.churchName} disabled={!canManage} className="field-control disabled:bg-slate-50" placeholder="Nome da igreja" />
            <div className="flex items-center gap-2 md:col-span-2">
              {logoPreview && (
                <img src={logoPreview} alt="Logo da igreja" className="h-11 w-11 shrink-0 rounded-2xl object-cover" />
              )}
              <input
                name="logoUrl"
                value={logoPreview}
                onChange={(event) => setLogoPreview(event.target.value)}
                disabled={!canManage}
                className="field-control flex-1 disabled:bg-slate-50"
                placeholder="URL do logo (ou envie um arquivo)"
              />
              {canManage && (
                <label className="flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-[18px] bg-slate-950 px-3 text-xs font-black text-white">
                  {uploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <ImageUp size={16} />}
                  Enviar
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleLogoFile(event.target.files?.[0])}
                  />
                </label>
              )}
            </div>
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

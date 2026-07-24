"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Copy, Crown, LifeBuoy, LogIn, Loader2, Plus, RefreshCcw, ScrollText, Send, ShieldCheck, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { impersonateChurchAdmin } from "@/lib/platform/impersonate";
import { supabase } from "@/lib/supabase/client";
import { AuditoriaTab } from "./auditoria-tab";
import { FinanceiroTab } from "./financeiro-tab";
import { SuporteTab } from "./suporte-tab";

type PlatformTab = "visao-geral" | "financeiro" | "suporte" | "auditoria";

const TABS: { id: PlatformTab; label: string; icon: typeof Building2 }[] = [
  { id: "visao-geral", label: "Visao geral", icon: Building2 },
  { id: "financeiro", label: "Financeiro", icon: Wallet },
  { id: "suporte", label: "Suporte", icon: LifeBuoy },
  { id: "auditoria", label: "Auditoria", icon: ScrollText },
];

type PlatformChurch = {
  church_id: string;
  church_name: string;
  city: string | null;
  state: string | null;
  created_at: string;
  admins_count: number;
  profiles_count: number;
  cells_count: number;
  people_count: number;
  invites_count: number;
  primary_admin_id: string | null;
  primary_admin_name: string | null;
};

type CreatedChurch = {
  church_id: string;
  invite_id: string;
  invite_token: string;
};

function inviteUrl(token: string) {
  if (typeof window === "undefined") {
    return `/convite/${token}`;
  }

  return `${window.location.origin}/convite/${token}`;
}

export default function PlatformPage() {
  const { currentUser, isDemoMode } = useAuth();
  const [activeTab, setActiveTab] = useState<PlatformTab>("visao-geral");
  const [churches, setChurches] = useState<PlatformChurch[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [impersonatingChurchId, setImpersonatingChurchId] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<{ churchName: string; adminName: string; link: string } | null>(null);
  const totalPeople = useMemo(() => churches.reduce((sum, church) => sum + Number(church.people_count || 0), 0), [churches]);
  const totalCells = useMemo(() => churches.reduce((sum, church) => sum + Number(church.cells_count || 0), 0), [churches]);
  const canBootstrap = currentUser.role === "admin" && !currentUser.platformAdmin;

  const loadChurches = useCallback(async () => {
    if (!currentUser.platformAdmin || isDemoMode) {
      return;
    }

    setLoading(true);
    setError("");
    const { data, error: listError } = await supabase.rpc("platform_list_churches");
    setLoading(false);

    if (listError) {
      setError(listError.message);
      return;
    }

    setChurches((data ?? []) as PlatformChurch[]);
  }, [currentUser.platformAdmin, isDemoMode]);

  useEffect(() => {
    queueMicrotask(() => {
      loadChurches();
    });
  }, [loadChurches]);

  async function activatePlatformAdmin() {
    setBootstrapping(true);
    setError("");
    setFeedback("");

    const { error: bootstrapError } = await supabase.rpc("bootstrap_platform_admin");
    setBootstrapping(false);

    if (bootstrapError) {
      setError(bootstrapError.message);
      return;
    }

    setFeedback("Admin geral ativado. Recarregando seu acesso...");
    window.setTimeout(() => window.location.reload(), 900);
  }

  async function createChurch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser.platformAdmin) {
      setError("Ative o admin geral antes de criar igrejas pela plataforma.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const churchName = String(formData.get("churchName") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const state = String(formData.get("state") || "").trim();
    const adminName = String(formData.get("adminName") || "").trim();
    const adminEmail = String(formData.get("adminEmail") || "").trim();

    if (!churchName || !adminName || !adminEmail) {
      setError("Informe igreja, nome do admin e email do admin.");
      return;
    }

    setCreating(true);
    setError("");
    setFeedback("");

    const { data, error: createError } = await supabase.rpc("platform_create_church_with_admin_invite", {
      church_name: churchName,
      church_city: city || null,
      church_state: state || null,
      admin_name: adminName,
      admin_email: adminEmail,
    });

    setCreating(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    const created = Array.isArray(data) ? (data[0] as CreatedChurch | undefined) : (data as CreatedChurch | null);
    if (!created?.invite_token) {
      setError("Igreja criada, mas nao recebi o token do convite.");
      await loadChurches();
      return;
    }

    const link = inviteUrl(created.invite_token);
    setLastInvite({ churchName, adminName, link });
    setFeedback(`${churchName} criada. Convite do administrador pronto para envio.`);
    event.currentTarget.reset();
    await loadChurches();
  }

  async function enterAsAdmin(church: PlatformChurch) {
    if (!church.primary_admin_id) {
      setError("Esta igreja ainda nao tem um admin ou pastor ativo para entrar.");
      return;
    }

    setImpersonatingChurchId(church.church_id);
    setError("");
    const result = await impersonateChurchAdmin(church.church_id, church.primary_admin_id);
    setImpersonatingChurchId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    window.setTimeout(() => {
      window.location.href = "/dashboard";
    }, 0);
  }

  async function copyInvite() {
    if (!lastInvite) {
      return;
    }

    await navigator.clipboard?.writeText(lastInvite.link);
    setFeedback("Link copiado.");
  }

  async function shareInvite() {
    if (!lastInvite) {
      return;
    }

    const text = `Ola, ${lastInvite.adminName}! Aqui esta seu convite para administrar ${lastInvite.churchName} no Ovelhas: ${lastInvite.link}`;

    if (navigator.share) {
      await navigator.share({ title: `Convite Ovelhas - ${lastInvite.churchName}`, text, url: lastInvite.link });
      return;
    }

    await navigator.clipboard?.writeText(text);
    setFeedback("Mensagem copiada.");
  }

  if (!currentUser.platformAdmin) {
    return (
      <AppShell>
        <section className="animate-enter mx-auto max-w-2xl space-y-4">
          <div className="rounded-[28px] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/15">
            <Crown size={34} className="text-emerald-200" />
            <h1 className="mt-5 text-3xl font-black leading-tight">Admin geral da plataforma</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
              Esta area cria novas igrejas, gera o primeiro administrador de cada uma e acompanha todas as igrejas que usam o Ovelhas.
            </p>
          </div>

          {error && <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</div>}
          {feedback && <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">{feedback}</div>}

          <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                <ShieldCheck size={19} />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-950">Ativar primeiro admin geral</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  So o primeiro admin geral pode ser ativado por aqui. Depois disso, somente um admin geral existente deve controlar a plataforma.
                </p>
              </div>
            </div>

            {canBootstrap ? (
              <button onClick={activatePlatformAdmin} disabled={bootstrapping} className="primary-action mt-4 disabled:opacity-60">
                {bootstrapping ? <Loader2 className="animate-spin" size={18} /> : <Crown size={18} />}
                {bootstrapping ? "Ativando..." : "Ativar meu acesso geral"}
              </button>
            ) : (
              <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
                Este acesso nao pode ativar a administracao geral. Entre com o admin principal da primeira igreja.
              </p>
            )}
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader
          eyebrow="SaaS"
          title="Admin geral"
          action={
            <button
              onClick={loadChurches}
              className="flex min-h-10 items-center gap-2 rounded-2xl bg-white px-3 text-xs font-black text-slate-700 shadow-sm"
            >
              <RefreshCcw size={15} />
              Atualizar
            </button>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[24px] bg-slate-950 p-4 text-white">
            <Building2 size={20} className="text-emerald-200" />
            <p className="mt-3 text-3xl font-black">{churches.length}</p>
            <p className="text-sm font-semibold text-slate-300">Igrejas</p>
          </div>
          <div className="rounded-[24px] bg-white/90 p-4 shadow-sm">
            <ShieldCheck size={20} className="text-emerald-700" />
            <p className="mt-3 text-3xl font-black text-slate-950">{churches.reduce((sum, church) => sum + Number(church.admins_count || 0), 0)}</p>
            <p className="text-sm font-semibold text-slate-500">Admins</p>
          </div>
          <div className="rounded-[24px] bg-white/90 p-4 shadow-sm">
            <Plus size={20} className="text-sky-700" />
            <p className="mt-3 text-3xl font-black text-slate-950">{totalCells}</p>
            <p className="text-sm font-semibold text-slate-500">Celulas</p>
          </div>
          <div className="rounded-[24px] bg-white/90 p-4 shadow-sm">
            <CheckCircle2 size={20} className="text-amber-700" />
            <p className="mt-3 text-3xl font-black text-slate-950">{totalPeople}</p>
            <p className="text-sm font-semibold text-slate-500">Pessoas</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-black transition-colors ${
                  active ? "bg-slate-950 text-white" : "bg-white/90 text-slate-500 shadow-sm"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "visao-geral" && (
          <>
            {error && <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</div>}
            {feedback && <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">{feedback}</div>}

            <form onSubmit={createChurch} className="native-form rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-sm sm:p-5">
              <SectionHeader eyebrow="Nova igreja" title="Criar cliente e admin" />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="churchName" required className="field-control md:col-span-2" placeholder="Nome da igreja" />
                <input name="city" className="field-control" placeholder="Cidade" />
                <input name="state" className="field-control" placeholder="Estado" />
                <input name="adminName" required className="field-control" placeholder="Nome do admin da igreja" />
                <input name="adminEmail" required type="email" className="field-control" placeholder="Email do admin" />
              </div>
              <button disabled={creating} className="primary-action mt-4 disabled:opacity-60">
                {creating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                {creating ? "Criando igreja..." : "Criar igreja e gerar convite"}
              </button>
            </form>

            {lastInvite && (
              <section className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                <p className="text-xs font-black uppercase text-emerald-800">Convite gerado</p>
                <h3 className="mt-1 text-xl font-black text-emerald-950">{lastInvite.churchName}</h3>
                <p className="mt-2 break-all rounded-2xl bg-white/80 p-3 text-xs font-bold text-emerald-900">{lastInvite.link}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={copyInvite} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white">
                    <Copy size={16} />
                    Copiar
                  </button>
                  <button onClick={shareInvite} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-4 text-sm font-black text-white">
                    <Send size={16} />
                    Enviar
                  </button>
                </div>
              </section>
            )}

            <section className="space-y-3">
              <SectionHeader eyebrow="Clientes" title="Igrejas cadastradas" />
              {loading && (
                <div className="rounded-[24px] border border-sky-100 bg-sky-50 p-4 text-sm font-bold text-sky-800">
                  Carregando igrejas...
                </div>
              )}
              {churches.map((church) => (
                <article key={church.church_id} className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-slate-950">{church.church_name}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {[church.city, church.state].filter(Boolean).join(" - ") || "Localidade nao informada"}
                      </p>
                      <p className="mt-2 break-all text-[11px] font-bold text-slate-400">{church.church_id}</p>
                    </div>
                    <span className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
                      {church.admins_count} admin
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-2xl bg-slate-50 p-2">
                      <p className="text-lg font-black">{church.profiles_count}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-400">usuarios</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-2">
                      <p className="text-lg font-black">{church.cells_count}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-400">celulas</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-2">
                      <p className="text-lg font-black">{church.people_count}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-400">pessoas</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-2">
                      <p className="text-lg font-black">{church.invites_count}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-400">convites</p>
                    </div>
                  </div>
                  <button
                    onClick={() => enterAsAdmin(church)}
                    disabled={!church.primary_admin_id || impersonatingChurchId === church.church_id}
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-40"
                  >
                    {impersonatingChurchId === church.church_id ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <LogIn size={16} />
                    )}
                    {church.primary_admin_id
                      ? `Entrar como ${church.primary_admin_name}`
                      : "Sem admin ativo ainda"}
                  </button>
                </article>
              ))}
              {!loading && churches.length === 0 && (
                <p className="rounded-[24px] bg-white/90 p-5 text-center text-sm font-semibold text-slate-500">
                  Nenhuma igreja carregada ainda.
                </p>
              )}
            </section>
          </>
        )}

        {activeTab === "financeiro" && <FinanceiroTab />}
        {activeTab === "suporte" && <SuporteTab />}
        {activeTab === "auditoria" && <AuditoriaTab />}
      </section>
    </AppShell>
  );
}

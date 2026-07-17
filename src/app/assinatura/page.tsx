"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Check, CreditCard, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { getScopedPeople } from "@/lib/access-control";
import { roleLabels } from "@/lib/data";
import { useChurchSubscription, useLocalPeople } from "@/lib/local-store";
import { openBillingPortal, startCheckout } from "@/lib/stripe/actions";
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_TIER_ORDER,
  getSupportWhatsAppLink,
  isSubscriptionBlocked,
  suggestTier,
  type SubscriptionTier,
} from "@/lib/subscription-plans";

function statusLabel(status: string | undefined) {
  const labels: Record<string, string> = {
    trialing: "Em teste gratis",
    active: "Ativa",
    past_due: "Pagamento atrasado",
    canceled: "Cancelada",
    incomplete: "Aguardando pagamento",
    incomplete_expired: "Expirada sem pagamento",
    unpaid: "Nao paga",
    lifetime: "Cortesia (acesso vitalicio)",
  };
  return status ? (labels[status] ?? status) : "Sem assinatura";
}

function statusTone(status: string | undefined) {
  if (status === "lifetime") {
    return "bg-violet-100 text-violet-800";
  }
  if (status === "active" || status === "trialing") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "past_due") {
    return "bg-amber-100 text-amber-900";
  }
  if (isSubscriptionBlocked(status)) {
    return "bg-rose-100 text-rose-800";
  }
  return "bg-slate-100 text-slate-500";
}

function formatDate(value: string | undefined) {
  if (!value) {
    return null;
  }
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export default function SubscriptionPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { subscription, isLoadingSubscription, refreshSubscription } = useChurchSubscription(currentUser.churchId);
  const toast = useToast();
  const searchParams = useSearchParams();
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "sucesso") {
      toast.success("Pagamento iniciado. Pode levar alguns segundos para o status atualizar aqui.");
      const timer = setTimeout(refreshSubscription, 3000);
      return () => clearTimeout(timer);
    }

    if (status === "cancelado") {
      toast.warning("Checkout cancelado. Nenhuma cobranca foi feita.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const canManageBilling = currentUser.role === "admin" || currentUser.role === "pastor";
  const churchPeopleCount = getScopedPeople(currentUser, people, isDemoMode).length;
  const recommendedTier = suggestTier(churchPeopleCount);
  const blocked = isSubscriptionBlocked(subscription?.status);
  const hasCustomer = Boolean(subscription?.stripeCustomerId);

  async function handleSubscribe(tier: SubscriptionTier) {
    if (!canManageBilling) {
      return;
    }

    setLoadingTier(tier);
    const result = await startCheckout(currentUser.churchId, tier);
    setLoadingTier(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const checkoutUrl = result.url;
    window.setTimeout(() => {
      window.location.href = checkoutUrl;
    }, 0);
  }

  async function handleManage() {
    if (!canManageBilling) {
      return;
    }

    setOpeningPortal(true);
    const result = await openBillingPortal(currentUser.churchId);
    setOpeningPortal(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const portalUrl = result.url;
    window.setTimeout(() => {
      window.location.href = portalUrl;
    }, 0);
  }

  if (isDemoMode) {
    return (
      <AppShell>
        <section className="animate-enter space-y-5">
          <SectionHeader eyebrow={roleLabels[currentUser.role]} title="Assinatura" />
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-5 text-sm leading-6 text-emerald-900">
            O modo demonstracao nao usa assinatura real. Entre com uma conta real vinculada a uma igreja para gerenciar
            o pagamento.
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader eyebrow={roleLabels[currentUser.role]} title="Assinatura" />

        {blocked && (
          <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Acesso da igreja bloqueado por pendencia de pagamento.</p>
              <p className="mt-1">
                {canManageBilling
                  ? "Assine novamente abaixo para liberar o acesso de toda a lideranca."
                  : "Fale com o administrador ou pastor da sua igreja para regularizar a assinatura."}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Status atual</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${statusTone(subscription?.status)}`}>
                  {isLoadingSubscription ? "Carregando..." : statusLabel(subscription?.status)}
                </span>
                {subscription?.tier && (
                  <span className="text-sm font-semibold text-slate-600">
                    Plano {SUBSCRIPTION_PLANS[subscription.tier].label}
                  </span>
                )}
              </div>
              {subscription?.status === "trialing" && formatDate(subscription.trialEndsAt) && (
                <p className="mt-2 text-sm text-slate-500">Teste gratis ate {formatDate(subscription.trialEndsAt)}.</p>
              )}
              {subscription?.currentPeriodEnd && subscription.status !== "trialing" && (
                <p className="mt-2 text-sm text-slate-500">
                  {subscription.cancelAtPeriodEnd ? "Cancela em" : "Proxima cobranca em"} {formatDate(subscription.currentPeriodEnd)}.
                </p>
              )}
            </div>

            {canManageBilling && hasCustomer && (
              <button
                onClick={handleManage}
                disabled={openingPortal}
                className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                <CreditCard size={17} />
                {openingPortal ? "Abrindo..." : "Gerenciar assinatura"}
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">
            <Users size={16} className="shrink-0 text-emerald-700" />
            {churchPeopleCount} pessoa(s) cadastradas
            {subscription?.tier && SUBSCRIPTION_PLANS[subscription.tier].limit
              ? ` de ate ${SUBSCRIPTION_PLANS[subscription.tier].limit} no plano atual`
              : ""}
            .
          </div>
        </div>

        {canManageBilling && (!subscription || blocked || subscription.status === "incomplete") && (
          <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Planos" title="Escolha o plano da igreja" />
            <div className="grid gap-3 md:grid-cols-4">
              {SUBSCRIPTION_TIER_ORDER.map((tier) => {
                const plan = SUBSCRIPTION_PLANS[tier];
                const recommended = tier === recommendedTier;

                return (
                  <article
                    key={tier}
                    className={`rounded-lg border p-4 ${recommended ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-950">{plan.label}</p>
                      {recommended && (
                        <span className="flex items-center gap-1 rounded-lg bg-emerald-900 px-2 py-1 text-[10px] font-bold text-white">
                          <Check size={12} />
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {plan.limit ? `Ate ${plan.limit} pessoas` : "Acima de 800 pessoas"}
                    </p>
                    <p className="mt-3 text-2xl font-black text-slate-950">{plan.priceLabel}</p>
                    <button
                      onClick={() => handleSubscribe(tier)}
                      disabled={loadingTier !== null}
                      className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white disabled:opacity-60"
                    >
                      <ShieldCheck size={16} />
                      {loadingTier === tier ? "Abrindo..." : "Assinar"}
                    </button>
                  </article>
                );
              })}

              <article className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-bold text-slate-950">Personalizado</p>
                <p className="mt-1 text-sm text-slate-500">Igreja com mais de uma sede ou necessidades especiais</p>
                <p className="mt-3 text-2xl font-black text-slate-950">Sob consulta</p>
                <a
                  href={getSupportWhatsAppLink(`Ola! Quero saber mais sobre o plano personalizado do Ovelhas para a igreja ${currentUser.churchId}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white"
                >
                  <MessageCircle size={16} />
                  Falar com suporte
                </a>
              </article>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">
              14 dias de teste gratis. Cobranca recorrente mensal no cartao de credito, cancele quando quiser.
            </p>
          </section>
        )}

        {!canManageBilling && (
          <div className="rounded-lg border border-white/80 bg-white/90 p-5 text-sm leading-6 text-slate-500">
            Somente administrador ou pastor podem gerenciar a assinatura da igreja.
          </div>
        )}
      </section>
    </AppShell>
  );
}

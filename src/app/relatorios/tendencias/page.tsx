"use client";

import Link from "next/link";
import { ArrowLeft, HeartHandshake, TrendingUp, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { MetricCard } from "@/components/metric-card";
import { SectionHeader } from "@/components/section-header";
import { StageFunnelChart } from "@/components/stage-funnel-chart";
import { TrendLineChart } from "@/components/trend-line-chart";
import { getScopedCells, getScopedPeople, getScopedSupervisorVisits } from "@/lib/access-control";
import { useCells, useLocalPeople, useSupervisorVisits } from "@/lib/local-store";
import { monthlyAverageHealth, monthlyNewPeople, stageDistribution } from "@/lib/trends";

const COLOR_GROWTH = "#059669";
const COLOR_HEALTH = "#0284c7";
const COLOR_FUNNEL = "#7c3aed";

export default function TrendsPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { visits } = useSupervisorVisits();
  const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visibleVisits = getScopedSupervisorVisits(currentUser, visits, cells, isDemoMode);

  const growthData = monthlyNewPeople(visiblePeople);
  const healthData = monthlyAverageHealth(visibleVisits);
  const stageData = stageDistribution(visiblePeople);

  const currentMonthGrowth = growthData[growthData.length - 1]?.value ?? 0;
  const healthPoints = healthData.filter((point) => point.value !== null);
  const currentHealth = healthPoints[healthPoints.length - 1]?.value ?? null;
  const activeDiscipleshipCount = visiblePeople.filter((person) => person.stage !== "Visitante").length;
  const activeDiscipleshipShare = visiblePeople.length
    ? Math.round((activeDiscipleshipCount / visiblePeople.length) * 100)
    : 0;

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <div className="flex items-center gap-3">
          <Link
            href="/relatorios"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm"
            aria-label="Voltar para relatorios"
          >
            <ArrowLeft size={18} />
          </Link>
          <SectionHeader eyebrow="Relatorios" title="Tendencias" />
        </div>

        <p className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          Leitura dos ultimos 6 meses para {visibleCells.length} celula(s) e {visiblePeople.length} pessoa(s)
          visiveis ao seu acesso. Meses sem registro aparecem como &quot;sem dados&quot;, nunca como zero forcado.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard icon={Users} label="Pessoas novas este mes" value={String(currentMonthGrowth)} accent="bg-emerald-500" />
          <MetricCard
            icon={HeartHandshake}
            label="Saude media das celulas"
            value={currentHealth !== null ? `${currentHealth}%` : "--"}
            accent="bg-sky-500"
          />
          <MetricCard icon={TrendingUp} label="Em discipulado ativo" value={`${activeDiscipleshipShare}%`} accent="bg-violet-500" />
        </div>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <TrendLineChart
            title="Crescimento — novas pessoas por mes"
            data={growthData}
            color={COLOR_GROWTH}
            emptyLabel="Ainda sem historico de primeira visita para calcular crescimento."
          />
        </section>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <TrendLineChart
            title="Saude das celulas — media mensal"
            data={healthData}
            color={COLOR_HEALTH}
            yMax={100}
            valueSuffix="%"
            emptyLabel="Ainda sem visitas de supervisao registradas neste periodo."
          />
        </section>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <StageFunnelChart title="Funil de discipulado — retrato atual" data={stageData} color={COLOR_FUNNEL} />
        </section>
      </section>
    </AppShell>
  );
}

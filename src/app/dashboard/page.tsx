"use client";

import Link from "next/link";
import { Bell, BellRing, CalendarCheck, CalendarDays, CheckCircle2, FileText, HeartHandshake, LayoutGrid, PlayCircle, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CareTaskCard } from "@/components/care-task-card";
import { ChurchNoticeCard } from "@/components/church-notice-card";
import { MetricCard } from "@/components/metric-card";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { getScopedActivityEvents, getScopedCareTasks, getScopedCells, getScopedPeople } from "@/lib/access-control";
import { getNextMeetingDate } from "@/lib/cell-schedule";
import { isChurchNotice } from "@/lib/church-notices";
import { computeDiscipleshipProgress } from "@/lib/discipleship";
import { useActivityEvents, useCareTasks, useCells, useDiscipleship, useLocalPeople } from "@/lib/local-store";

export default function DashboardPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { tasks } = useCareTasks();
  const { events } = useActivityEvents();
  const { tracks, accesses, videos, progress: videoProgress } = useDiscipleship();
  const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visibleCareTasks = getScopedCareTasks(currentUser, tasks, people, isDemoMode);
  const visibleNotices = getScopedActivityEvents(currentUser, events, cells, people, isDemoMode)
    .filter(isChurchNotice)
    .slice(0, 3);
  const present = visiblePeople.filter((person) => person.cellAbsences === 0).length;
  const servicePresent = visiblePeople.filter((person) => person.servicePresent).length;
  const discipleshipProgress = visiblePeople
    .map((person) => ({ person, progress: computeDiscipleshipProgress(person.id, accesses, videos, videoProgress) }))
    .filter((item): item is { person: (typeof visiblePeople)[number]; progress: number } => item.progress !== null);
  const averageProgress = discipleshipProgress.length
    ? Math.round(discipleshipProgress.reduce((sum, item) => sum + item.progress, 0) / discipleshipProgress.length)
    : 0;
  const activeTrack = tracks.find((track) => track.active);
  const activeTrackLabel = activeTrack ? activeTrack.title : "Nenhuma trilha ativa";
  const primaryCell = visibleCells[0];
  const nextMeetingLabel = primaryCell
    ? `${primaryCell.meetingDay}, ${primaryCell.meetingTime}`
    : "Sem celula atribuida";
  const nextMeetingDate = primaryCell
    ? new Date(`${getNextMeetingDate(primaryCell.meetingDay)}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : null;

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <OnboardingChecklist />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard icon={LayoutGrid} label="Celulas" value={String(visibleCells.length)} accent="bg-emerald-500" />
          <MetricCard icon={Users} label="Pessoas" value={String(visiblePeople.length)} accent="bg-sky-500" />
          <MetricCard icon={CheckCircle2} label="Presentes" value={String(present)} accent="bg-sky-500" />
          <MetricCard icon={Bell} label="Cuidados" value={String(visibleCareTasks.length)} accent="bg-amber-500" />
        </div>

        <div className="rounded-lg border border-white/80 bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-emerald-200">Hoje</p>
              <h2 className="mt-1 text-2xl font-semibold">Cuidado pastoral em movimento</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                O painel prioriza pessoas, presenca e discipulado para o lider agir rapido pelo celular.
              </p>
            </div>
            <CalendarCheck className="hidden text-emerald-200 sm:block" size={32} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-xs text-slate-300">Culto</p>
              <p className="mt-1 text-lg font-semibold">{servicePresent} confirmados</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-xs text-slate-300">Trilha ativa</p>
              <p className="mt-1 truncate text-lg font-semibold">{activeTrackLabel}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-xs text-slate-300">Proxima celula</p>
              <p className="mt-1 truncate text-lg font-semibold">{nextMeetingLabel}</p>
              {nextMeetingDate && <p className="mt-0.5 text-xs text-slate-300">{nextMeetingDate}</p>}
            </div>
          </div>
          <Link
            href="/presenca"
            className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-950/20"
          >
            <CalendarCheck size={18} />
            Registrar presenca
          </Link>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { href: "/presenca", label: "Presenca", icon: CalendarCheck },
            { href: "/celulas", label: "Celulas", icon: LayoutGrid },
            { href: "/relatorios/novo", label: "Relatorio", icon: FileText },
            { href: "/agenda", label: "Agenda", icon: CalendarDays },
            { href: "/videos", label: "Videos", icon: PlayCircle },
            { href: "/cuidados", label: "Cuidados", icon: HeartHandshake },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-white/80 bg-white/90 p-4 text-center text-sm font-bold text-slate-700 shadow-sm hover:border-emerald-200"
            >
              <Icon className="mx-auto mb-2 text-emerald-800" size={22} />
              {label}
            </Link>
          ))}
        </section>

        {visibleNotices.length > 0 && (
          <section className="rounded-[28px] border border-white/80 bg-white/60 p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-black uppercase text-emerald-700">News da igreja</p>
                <h2 className="text-lg font-black text-slate-950">Comunicados recentes</h2>
              </div>
              <BellRing className="text-emerald-800" size={22} />
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {visibleNotices.map((event) => (
                <ChurchNoticeCard key={event.id} event={event} compact />
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Acoes" title="Cuidados recomendados" />
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleCareTasks.slice(0, 4).map((task) => (
                <CareTaskCard key={task.id} task={task} person={visiblePeople.find((person) => person.id === task.personId)} />
              ))}
              {visibleCareTasks.length === 0 && (
                <p className="rounded-lg bg-slate-50 p-4 text-sm font-medium text-slate-500">
                  Nenhum cuidado pendente para este perfil.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Discipulado" title={`Progresso medio: ${averageProgress}%`} />
            <div className="space-y-4">
              {discipleshipProgress.map(({ person, progress }) => (
                <Link key={person.id} href={`/pessoas/${person.id}`} className="block">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-slate-700">{person.name}</span>
                    <span className="font-semibold text-emerald-700">{progress}%</span>
                  </div>
                  <ProgressBar value={progress} />
                </Link>
              ))}
              {discipleshipProgress.length === 0 && (
                <p className="rounded-lg bg-slate-50 p-4 text-sm font-medium text-slate-500">
                  Nenhuma pessoa com trilha de discipulado liberada ainda.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}

"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Crown, Eye, Save, ShieldCheck, UserCog } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { MetricCard } from "@/components/metric-card";
import { SectionHeader } from "@/components/section-header";
import { canAssignCellResponsibility, getScopedCells, getScopedPeople, getScopedSupervisorVisits } from "@/lib/access-control";
import { roleLabels, type UserRole } from "@/lib/data";
import { useActivityEvents, useCells, useLocalPeople, useProfiles, useSupervisorVisits } from "@/lib/local-store";
import { getCellStats } from "@/lib/reports";

function getResponsibilityStatus({
  hasSupervisor,
  hasLeader,
  hasMembers,
  hasRecentVisit,
}: {
  hasSupervisor: boolean;
  hasLeader: boolean;
  hasMembers: boolean;
  hasRecentVisit: boolean;
}) {
  if (!hasSupervisor || !hasLeader) {
    return { label: "Responsavel faltando", tone: "bg-rose-100 text-rose-800" };
  }

  if (!hasMembers) {
    return { label: "Sem membros", tone: "bg-amber-100 text-amber-900" };
  }

  if (!hasRecentVisit) {
    return { label: "Sem supervisao recente", tone: "bg-amber-100 text-amber-900" };
  }

  return { label: "Cuidado coberto", tone: "bg-emerald-100 text-emerald-800" };
}

export default function ManagementPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells, updateCellAssignment } = useCells();
  const { people } = useLocalPeople();
  const { visits } = useSupervisorVisits();
  const { profiles, updateProfileRole } = useProfiles();
  const { addEvent } = useActivityEvents();
  const [assignmentCellId, setAssignmentCellId] = useState("");
  const [assignmentSupervisorId, setAssignmentSupervisorId] = useState("");
  const [assignmentLeaderId, setAssignmentLeaderId] = useState("");
  const [roleUserId, setRoleUserId] = useState("");
  const [roleValue, setRoleValue] = useState<UserRole>("member");
  const [feedback, setFeedback] = useState("");
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);
  const visibleVisits = getScopedSupervisorVisits(currentUser, visits, cells, isDemoMode);
  const visibleProfiles = profiles.filter((profile) => profile.churchId === currentUser.churchId || isDemoMode);
  const supervisors = visibleProfiles.filter((user) => user.role === "supervisor");
  const leaders = visibleProfiles.filter((user) => user.role === "leader");
  const cellsWithoutSupervisor = visibleCells.filter((cell) => !cell.supervisorUserId).length;
  const cellsWithoutLeader = visibleCells.filter((cell) => !cell.leaderUserId).length;
  const peopleWithoutLeader = visiblePeople.filter((person) => !person.leaderUserId).length;
  const leadershipUsers = visibleProfiles.filter((user) => user.role !== "member").length;
  const canAssignCells = canAssignCellResponsibility(currentUser);
  const canManageRoles = currentUser.role === "admin";
  const selectedAssignmentCell = visibleCells.find((cell) => cell.id === (assignmentCellId || visibleCells[0]?.id));

  async function handleAssignmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cell = selectedAssignmentCell;
    if (!cell) {
      setFeedback("Escolha uma celula antes de salvar.");
      return;
    }

    const leader = leaders.find((item) => item.id === assignmentLeaderId);
    const nextSupervisorId =
      currentUser.role === "supervisor" ? currentUser.id : assignmentSupervisorId || cell.supervisorUserId;
    const supervisor = supervisors.find((item) => item.id === nextSupervisorId);
    const result = await updateCellAssignment({
      cellId: cell.id,
      leaderUserId: assignmentLeaderId || cell.leaderUserId,
      leaderName: leader?.name ?? cell.leaderName,
      supervisorUserId: nextSupervisorId,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setFeedback(`Nao consegui salvar no Supabase: ${result.error}`);
      return;
    }

    await addEvent({
      churchId: currentUser.churchId,
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "Atualizou responsabilidades",
      description: `${currentUser.name} ajustou a cobertura da celula ${cell.name}.`,
      targetType: "cell",
      targetId: cell.id,
      targetName: cell.name,
      cellId: cell.id,
      visibility: "leadership",
      persistToSupabase: !isDemoMode,
    });

    setFeedback(
      `Responsabilidades salvas: ${cell.name} com ${supervisor?.name ?? "supervisor mantido"} e ${leader?.name ?? "lider mantido"}.`,
    );
  }

  async function handleRoleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!roleUserId) {
      setFeedback("Escolha um usuario para alterar o tipo de acesso.");
      return;
    }

    const user = visibleProfiles.find((profile) => profile.id === roleUserId);
    const result = await updateProfileRole({
      userId: roleUserId,
      role: roleValue,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setFeedback(`Nao consegui alterar o acesso no Supabase: ${result.error}`);
      return;
    }

    setFeedback(`${user?.name ?? "Usuario"} agora esta como ${roleLabels[roleValue]}.`);
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader eyebrow={roleLabels[currentUser.role]} title="Gestao de responsabilidades" />

        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-950">Matriz pastoral</p>
          <p className="mt-1 text-sm leading-5 text-emerald-800">
            O objetivo aqui e enxergar quem cuida de quem: pastor acompanha supervisores, supervisores acompanham celulas, lideres cuidam dos membros.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard icon={ShieldCheck} label="Lideranca" value={String(leadershipUsers)} accent="bg-emerald-500" />
          <MetricCard icon={Eye} label="Supervisores" value={String(supervisors.length)} accent="bg-sky-500" />
          <MetricCard icon={Crown} label="Lideres" value={String(leaders.length)} accent="bg-violet-500" />
          <MetricCard icon={AlertTriangle} label="Lacunas" value={String(cellsWithoutSupervisor + cellsWithoutLeader + peopleWithoutLeader)} accent="bg-amber-500" />
        </div>

        {canAssignCells && (
          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <form onSubmit={handleAssignmentSubmit} className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
              <SectionHeader eyebrow={currentUser.role === "supervisor" ? "Supervisor" : "Lideranca"} title="Atribuir celulas" />
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-2 text-sm font-semibold text-slate-700">
                  Celula
                  <select
                    value={assignmentCellId || visibleCells[0]?.id || ""}
                    onChange={(event) => setAssignmentCellId(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  >
                    {visibleCells.map((cell) => (
                      <option key={cell.id} value={cell.id}>
                        {cell.name}
                      </option>
                    ))}
                  </select>
                </label>

                {currentUser.role === "supervisor" ? (
                  <div className="space-y-2 text-sm font-semibold text-slate-700">
                    Supervisor
                    <div className="flex min-h-12 items-center rounded-lg border border-emerald-100 bg-emerald-50 px-3 text-sm font-bold text-emerald-900">
                      {currentUser.name}
                    </div>
                  </div>
                ) : (
                  <label className="space-y-2 text-sm font-semibold text-slate-700">
                    Supervisor
                    <select
                      value={assignmentSupervisorId}
                      onChange={(event) => setAssignmentSupervisorId(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="">Manter atual</option>
                      {supervisors.map((supervisor) => (
                        <option key={supervisor.id} value={supervisor.id}>
                          {supervisor.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="space-y-2 text-sm font-semibold text-slate-700">
                  Lider
                  <select
                    value={assignmentLeaderId}
                    onChange={(event) => setAssignmentLeaderId(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Manter atual</option>
                    {leaders.map((leader) => (
                      <option key={leader.id} value={leader.id}>
                        {leader.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
                <Save size={18} />
                Salvar cobertura pastoral
              </button>
            </form>

            {canManageRoles && (
              <form onSubmit={handleRoleSubmit} className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
                <SectionHeader eyebrow="Acesso" title="Promover usuario" />
                <div className="space-y-3">
                  <label className="space-y-2 text-sm font-semibold text-slate-700">
                    Usuario
                    <select
                      value={roleUserId}
                      onChange={(event) => setRoleUserId(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="">Escolher usuario</option>
                      {visibleProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name} - {roleLabels[profile.role]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-slate-700">
                    Novo tipo
                    <select
                      value={roleValue}
                      onChange={(event) => setRoleValue(event.target.value as UserRole)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="member">Membro</option>
                      <option value="leader">Lider</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="pastor">Pastor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </label>
                </div>
                <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">
                  <UserCog size={18} />
                  Alterar acesso
                </button>
              </form>
            )}
          </section>
        )}

        {feedback && (
          <div className="rounded-lg border border-emerald-100 bg-white p-4 text-sm font-semibold text-emerald-800 shadow-sm">
            {feedback}
          </div>
        )}

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Papeis" title="Quem pode fazer o que" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(["pastor", "supervisor", "leader", "member"] as UserRole[]).map((role) => {
              const roleUsers = visibleProfiles.filter((profile) => profile.role === role);

              return (
                <article key={role} className="rounded-lg bg-slate-50 p-4">
                  <p className="font-bold text-slate-950">{roleLabels[role]}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {role === "pastor" && "Administra a igreja no dia a dia: celulas, supervisores, lideres e membros."}
                    {role === "supervisor" && "Cria e monitora celulas, chama lideres e membros, e presta relatorio ao pastor."}
                    {role === "leader" && "Cuida da propria celula, membros, presencas e discipulado."}
                    {role === "member" && "Acessa apenas o proprio discipulado e informacoes pessoais."}
                  </p>
                  <div className="mt-4 space-y-2">
                    {roleUsers.length === 0 ? (
                      <p className="rounded-lg bg-white p-3 text-sm font-semibold text-slate-400">Nenhum usuario ainda.</p>
                    ) : (
                      roleUsers.slice(0, 4).map((profile) => (
                        <p key={profile.id} className="rounded-lg bg-white p-3 text-sm font-semibold text-slate-700">
                          {profile.name}
                        </p>
                      ))
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Responsabilidade" title="Celulas e cobertura" />
          <div className="space-y-3">
            {visibleCells.map((cell) => {
              const stats = getCellStats(cell, people);
              const cellVisits = visibleVisits.filter((visit) => visit.cellId === cell.id);
              const lastVisit = cellVisits[0];
              const hasRecentVisit = Boolean(lastVisit);
              const status = getResponsibilityStatus({
                hasSupervisor: Boolean(cell.supervisorUserId),
                hasLeader: Boolean(cell.leaderUserId),
                hasMembers: stats.total > 0,
                hasRecentVisit,
              });

              return (
                <article key={cell.id} className="rounded-lg bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{cell.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{cell.neighborhood} - {cell.meetingDay}, {cell.meetingTime}</p>
                    </div>
                    <span className={`w-fit rounded-lg px-2 py-1 text-xs font-bold ${status.tone}`}>{status.label}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-xs font-bold uppercase text-slate-400">Supervisor</p>
                      <p className="mt-1 truncate font-semibold text-slate-800">
                        {supervisors.find((user) => user.id === cell.supervisorUserId)?.name ?? "Sem supervisor"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-xs font-bold uppercase text-slate-400">Lider</p>
                      <p className="mt-1 truncate font-semibold text-slate-800">{cell.leaderName || "Sem lider"}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-xs font-bold uppercase text-slate-400">Membros</p>
                      <p className="mt-1 font-semibold text-slate-800">{stats.total}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-xs font-bold uppercase text-slate-400">Ultima supervisao</p>
                      <p className="mt-1 truncate font-semibold text-slate-800">{lastVisit?.visitDate ?? "Pendente"}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Acoes" title="Lacunas que exigem decisao" />
          <div className="space-y-3">
            {cellsWithoutSupervisor > 0 && (
              <div className="rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                Existem {cellsWithoutSupervisor} celulas sem supervisor. O administrador deve atribuir supervisao.
              </div>
            )}
            {cellsWithoutLeader > 0 && (
              <div className="rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                Existem {cellsWithoutLeader} celulas sem lider. Isso impede acompanhamento direto dos membros.
              </div>
            )}
            {peopleWithoutLeader > 0 && (
              <div className="rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                Existem {peopleWithoutLeader} pessoas sem lider responsavel. Elas devem aparecer em cuidado prioritario.
              </div>
            )}
            {cellsWithoutSupervisor + cellsWithoutLeader + peopleWithoutLeader === 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                <CheckCircle2 size={18} />
                Todas as responsabilidades principais estao cobertas.
              </div>
            )}
          </div>
        </section>
      </section>
    </AppShell>
  );
}

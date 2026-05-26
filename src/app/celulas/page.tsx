"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CalendarClock, MapPin, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { MetricCard } from "@/components/metric-card";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { canCreateCell, getVisibleCells } from "@/lib/access-control";
import { roleLabels } from "@/lib/data";
import { useCells, useLocalPeople, useProfiles } from "@/lib/local-store";
import { getCellStats } from "@/lib/reports";

export default function CellsPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { cells, addCell, updateCell, deleteCell, refreshCells, isLoadingCells, cellLoadError } = useCells();
  const { profiles } = useProfiles();
  const [open, setOpen] = useState(false);
  const [editingCellId, setEditingCellId] = useState("");
  const [feedback, setFeedback] = useState("");
  const visibleCells = isDemoMode ? getVisibleCells(currentUser, cells) : cells;
  const visibleCellIds = new Set(visibleCells.map((cell) => cell.id));
  const visiblePeople = people.filter((person) => visibleCellIds.has(person.cellId));
  const attention = visiblePeople.filter((person) => person.cellAbsences >= 2 || person.progress < 20).length;
  const visibleProfiles = profiles.filter((profile) => profile.churchId === currentUser.churchId || isDemoMode);
  const supervisors = visibleProfiles.filter((profile) => profile.role === "supervisor");
  const leaders = visibleProfiles.filter((profile) => profile.role === "leader");
  const canCreateNewCell = canCreateCell(currentUser);
  const editingCell = cells.find((cell) => cell.id === editingCellId);

  function openCreateCell() {
    setEditingCellId("");
    setOpen(true);
  }

  function openEditCell(cellId: string) {
    setEditingCellId(cellId);
    setOpen(true);
  }

  async function handleCreateCell(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const supervisorId =
      currentUser.role === "supervisor" ? currentUser.id : String(formData.get("supervisorId") || "");
    const leaderId = String(formData.get("leaderId") || "");
    const leader = leaders.find((profile) => profile.id === leaderId);

    if (!name) {
      setFeedback("Informe o nome da celula.");
      return;
    }

    const payload = {
      name,
      supervisorUserId: supervisorId,
      leaderUserId: leaderId,
      leaderName: leader?.name,
      meetingDay: String(formData.get("meetingDay") || "").trim(),
      meetingTime: String(formData.get("meetingTime") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      neighborhood: String(formData.get("neighborhood") || "").trim(),
      persistToSupabase: !isDemoMode,
    };

    const result = editingCell
      ? await updateCell({
          id: editingCell.id,
          ...payload,
        })
      : await addCell({
          churchId: currentUser.churchId,
          ...payload,
        });

    if (!result.ok) {
      setFeedback(`Nao consegui salvar a celula: ${result.error}`);
      return;
    }

    setFeedback(editingCell ? "Celula atualizada." : `${name} criada e pronta para receber pessoas.`);
    await refreshCells();
    setOpen(false);
    setEditingCellId("");
    event.currentTarget.reset();
  }

  async function handleDeleteCell(cellId: string, cellName: string) {
    if (!window.confirm(`Apagar a celula ${cellName}? Ela sera arquivada e deixara de aparecer nas listas.`)) {
      return;
    }

    const result = await deleteCell(cellId, !isDemoMode);
    setFeedback(result.ok ? "Celula apagada." : `Nao consegui apagar a celula: ${result.error}`);

    if (result.ok) {
      await refreshCells();
    }
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader
          eyebrow="Celulas"
          title="Acompanhamento por celula"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const result = await refreshCells();
                  setFeedback(result.ok ? "Celulas atualizadas." : `Nao consegui carregar celulas: ${result.error}`);
                }}
                className="flex h-11 items-center rounded-2xl bg-emerald-50 px-3 text-xs font-bold text-emerald-800"
              >
                {isLoadingCells ? "Carregando..." : "Atualizar"}
              </button>
              {canCreateNewCell ? (
                <button
                  onClick={openCreateCell}
                  className="flex h-11 items-center gap-2 rounded-2xl bg-emerald-900 px-4 text-sm font-bold text-white shadow-sm"
                >
                  <Plus size={18} />
                  Nova
                </button>
              ) : null}
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard icon={Users} label="Celulas" value={String(visibleCells.length)} accent="bg-emerald-500" />
          <MetricCard icon={Users} label="Pessoas" value={String(visiblePeople.length)} accent="bg-sky-500" />
          <MetricCard icon={CalendarClock} label="Atencao" value={String(attention)} accent="bg-amber-500" />
          <MetricCard icon={MapPin} label="Bairros" value={String(new Set(visibleCells.map((cell) => cell.neighborhood)).size)} accent="bg-violet-500" />
        </div>

        {feedback && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            {feedback}
          </div>
        )}

        {cellLoadError && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            Nao consegui carregar celulas do Supabase: {cellLoadError}
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {visibleCells.map((cell) => {
            const stats = getCellStats(cell, people);
            return (
              <article key={cell.id} className="rounded-lg border border-white/80 bg-white/90 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-emerald-700">{cell.meetingDay}, {cell.meetingTime}</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">{cell.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">Lider: {cell.leaderName}</p>
                  </div>
                  <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">
                    {stats.attendanceRate}%
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Pessoas</p>
                    <p className="mt-1 text-lg font-semibold">{stats.total}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Presentes</p>
                    <p className="mt-1 text-lg font-semibold">{stats.present}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Alertas</p>
                    <p className="mt-1 text-lg font-semibold">{stats.attention}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600">Discipulado medio</span>
                    <span className="font-bold text-emerald-700">{stats.averageProgress}%</span>
                  </div>
                  <ProgressBar value={stats.averageProgress} />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin size={15} className="shrink-0 text-emerald-700" />
                    <span className="truncate">{cell.neighborhood}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => openEditCell(cell.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800"
                      aria-label={`Editar ${cell.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteCell(cell.id, cell.name)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700"
                      aria-label={`Apagar ${cell.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                    <Link href="/relatorios/novo" className="font-bold text-emerald-800">
                      Novo relatorio
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {visibleCells.length === 0 && (
          <div className="rounded-lg border border-white/80 bg-white/90 p-5 text-center text-sm font-medium text-slate-500">
            Nenhuma celula visivel para este perfil.
          </div>
        )}

        {open && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
            <form
              onSubmit={handleCreateCell}
              className="app-scrollbar animate-enter max-h-[92vh] w-full overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl shadow-slate-900/20 sm:max-w-xl"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-emerald-700">{roleLabels[currentUser.role]}</p>
                  <h2 className="text-xl font-semibold text-slate-950">{editingCell ? "Editar celula" : "Nova celula"}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setEditingCellId("");
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="name"
                  required
                  defaultValue={editingCell?.name ?? ""}
                  className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 sm:col-span-2"
                  placeholder="Nome da celula"
                />
                <input
                  name="neighborhood"
                  defaultValue={editingCell?.neighborhood ?? ""}
                  className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Bairro"
                />
                <input
                  name="address"
                  defaultValue={editingCell?.address ?? ""}
                  className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Endereco"
                />
                <input
                  name="meetingDay"
                  defaultValue={editingCell?.meetingDay ?? ""}
                  className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Dia da semana"
                />
                <input
                  name="meetingTime"
                  defaultValue={editingCell?.meetingTime ?? ""}
                  className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Horario"
                />
                {currentUser.role === "supervisor" ? (
                  <div className="flex min-h-12 items-center rounded-xl border border-emerald-100 bg-emerald-50 px-3 text-sm font-bold text-emerald-900">
                    Supervisor: {currentUser.name}
                  </div>
                ) : (
                  <select
                    name="supervisorId"
                    defaultValue={editingCell?.supervisorUserId ?? ""}
                    className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
                  >
                    <option value="">Sem supervisor por enquanto</option>
                    {supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  name="leaderId"
                  defaultValue={editingCell?.leaderUserId ?? ""}
                  className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value="">Sem lider por enquanto</option>
                  {leaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>
                      {leader.name}
                    </option>
                  ))}
                </select>
              </div>

              <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-bold text-white">
                <Save size={18} />
                {editingCell ? "Salvar alteracoes" : "Criar celula"}
              </button>
            </form>
          </div>
        )}
      </section>
    </AppShell>
  );
}

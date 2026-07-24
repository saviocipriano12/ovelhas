"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CalendarCheck, CalendarClock, MapPin, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { MetricCard } from "@/components/metric-card";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { canCreateCell, getScopedCells } from "@/lib/access-control";
import { roleLabels } from "@/lib/data";
import { useCells, useLocalPeople, useProfiles } from "@/lib/local-store";
import { getCellStats } from "@/lib/reports";

export default function CellsPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { cells, addCell, updateCell, deleteCell, refreshCells, isLoadingCells, cellLoadError } = useCells();
  const { profiles } = useProfiles();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editingCellId, setEditingCellId] = useState("");
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
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
    const meetingDay = String(formData.get("meetingDay") || "").trim();
    const meetingTime = String(formData.get("meetingTime") || "").trim();
    const supervisorId =
      currentUser.role === "supervisor" ? currentUser.id : String(formData.get("supervisorId") || "");
    const leaderId = String(formData.get("leaderId") || "");
    const leader = leaders.find((profile) => profile.id === leaderId);

    if (!name) {
      toast.error("Informe o nome da celula.");
      return;
    }

    if (!meetingDay || !meetingTime) {
      toast.error("Informe o dia e o horario da reuniao da celula.");
      return;
    }

    const payload = {
      name,
      supervisorUserId: supervisorId,
      leaderUserId: leaderId,
      leaderName: leader?.name,
      meetingDay,
      meetingTime,
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
      toast.error(`Nao consegui salvar a celula: ${result.error}`);
      return;
    }

    toast.success(editingCell ? "Celula atualizada." : `${name} criada e pronta para receber pessoas.`);
    await refreshCells();
    setOpen(false);
    setEditingCellId("");
    event.currentTarget.reset();
  }

  async function handleDeleteCell(cellId: string, cellName: string) {
    const confirmed = await confirm({
      title: `Apagar a celula ${cellName}?`,
      description: "Ela sera arquivada e deixara de aparecer nas listas.",
      confirmLabel: "Apagar",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    const result = await deleteCell(cellId, !isDemoMode);

    if (!result.ok) {
      toast.error(`Nao consegui apagar a celula: ${result.error}`);
      return;
    }

    toast.success("Celula apagada.");
    await refreshCells();
  }

  return (
    <AppShell hideMobileNav={open} hidePwaStatus={open}>
      <section className="animate-enter space-y-5">
        {!open && (
          <>
        <SectionHeader
          eyebrow="Celulas"
          title="Acompanhamento por celula"
          action={
            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
              <Link
                href="/presenca"
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 text-xs font-bold text-white"
              >
                <CalendarCheck size={16} />
                Registrar
              </Link>
              <button
                onClick={async () => {
                  const result = await refreshCells();
                  if (result.ok) {
                    toast.success("Celulas atualizadas.");
                  } else {
                    toast.error(`Nao consegui carregar celulas: ${result.error}`);
                  }
                }}
                className="flex h-11 items-center justify-center rounded-2xl bg-emerald-50 px-3 text-xs font-bold text-emerald-800"
              >
                {isLoadingCells ? "Carregando..." : "Atualizar"}
              </button>
              {canCreateNewCell ? (
                <button
                  onClick={openCreateCell}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-4 text-sm font-bold text-white shadow-sm"
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

        {cellLoadError && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            Nao consegui carregar celulas: {cellLoadError}
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
                    <Link href="/presenca" className="font-bold text-emerald-800">
                      Abrir chamada
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

          </>
        )}

        {open && (
          <form onSubmit={handleCreateCell} className="form-screen animate-enter mx-auto w-full max-w-6xl">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-1 py-3 backdrop-blur sm:px-0">
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
                  className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-700"
                  aria-label="Cancelar"
                >
                  <X size={18} />
                  <span className="hidden sm:inline">Cancelar</span>
                </button>
              </div>

              <div className="form-screen-body min-h-0 flex-1 py-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
                    <p className="mb-1 text-xs font-black uppercase text-emerald-700">Passo 1 de 2</p>
                    <h3 className="mb-4 text-lg font-black text-slate-950">Identidade da celula</h3>
                    <div className="space-y-3">
                      <input name="name" required defaultValue={editingCell?.name ?? ""} className="field-control" placeholder="Nome da celula" />
                      <input name="neighborhood" defaultValue={editingCell?.neighborhood ?? ""} className="field-control" placeholder="Bairro" />
                    </div>
                  </section>

                  <section className="rounded-[24px] bg-emerald-50 p-4 ring-1 ring-emerald-100">
                    <p className="mb-1 text-xs font-black uppercase text-emerald-700">Passo 2 de 2</p>
                    <h3 className="mb-4 text-lg font-black text-slate-950">Quando acontece?</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select name="meetingDay" required defaultValue={editingCell?.meetingDay ?? ""} className="field-control sm:col-span-2">
                        <option value="">Dia da semana</option>
                        <option>Segunda</option><option>Terca</option><option>Quarta</option><option>Quinta</option><option>Sexta</option><option>Sabado</option><option>Domingo</option>
                      </select>
                      <input name="meetingTime" required defaultValue={editingCell?.meetingTime ?? ""} className="field-control sm:col-span-2" placeholder="Horario, ex: 20h" />
                    </div>
                  </section>

                  <details className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100 lg:col-span-2">
                    <summary className="cursor-pointer list-none text-sm font-black text-slate-800 marker:hidden">
                      Endereco e responsabilidades <span className="ml-1 text-xs font-semibold text-slate-400">opcional</span>
                    </summary>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <input name="address" defaultValue={editingCell?.address ?? ""} className="field-control sm:col-span-2" placeholder="Endereco" />
                      {currentUser.role === "supervisor" ? (
                        <div className="flex min-h-[3.5rem] items-center rounded-2xl border border-emerald-100 bg-emerald-50 px-3 text-sm font-bold text-emerald-900">
                          Supervisor: {currentUser.name}
                        </div>
                      ) : (
                        <select name="supervisorId" defaultValue={editingCell?.supervisorUserId ?? ""} className="field-control">
                          <option value="">Sem supervisor por enquanto</option>
                          {supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
                        </select>
                      )}
                      <select name="leaderId" defaultValue={editingCell?.leaderUserId ?? ""} className="field-control">
                        <option value="">Sem lider por enquanto</option>
                        {leaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
                      </select>
                    </div>
                  </details>
                </div>
              </div>

              <div className="form-screen-footer shrink-0 border-t border-slate-200/80 bg-white/95 py-3 backdrop-blur">
                <button className="primary-action min-h-14">
                  <Save size={18} />
                  {editingCell ? "Salvar alteracoes" : "Criar celula"}
                </button>
              </div>
          </form>
        )}
      </section>
    </AppShell>
  );
}

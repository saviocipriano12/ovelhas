"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Church, ClipboardCheck, UsersRound, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { PersonAvatar } from "@/components/person-avatar";
import { SectionHeader } from "@/components/section-header";
import { getVisibleCells, getVisiblePeople } from "@/lib/access-control";
import {
  saveCellAttendance,
  saveServiceAttendance,
  useActivityEvents,
  useCareTasks,
  useCells,
  useLocalPeople,
} from "@/lib/local-store";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { people, updatePeople } = useLocalPeople();
  const { addCareTask } = useCareTasks();
  const { addEvent } = useActivityEvents();
  const visibleCells = getVisibleCells(currentUser, cells);
  const visiblePeople = getVisiblePeople(currentUser, people);
  const [selectedCellId, setSelectedCellId] = useState(visibleCells[0]?.id ?? "");
  const [meetingDate, setMeetingDate] = useState(todayIso());
  const [serviceDate, setServiceDate] = useState(todayIso());
  const [visitorsCount, setVisitorsCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState("");
  const selectedCell = visibleCells.find((cell) => cell.id === selectedCellId) ?? visibleCells[0];
  const cellPeople = visiblePeople.filter((person) => person.cellId === selectedCell?.id);
  const [cellPresence, setCellPresence] = useState<Record<string, boolean>>({});
  const [servicePresence, setServicePresence] = useState<Record<string, boolean>>({});

  const presentCount = useMemo(
    () => cellPeople.filter((person) => cellPresence[person.id] ?? person.cellAbsences === 0).length,
    [cellPeople, cellPresence],
  );
  const serviceCount = useMemo(
    () => cellPeople.filter((person) => servicePresence[person.id] ?? person.servicePresent).length,
    [cellPeople, servicePresence],
  );

  function markAll(value: boolean, type: "cell" | "service") {
    const next = Object.fromEntries(cellPeople.map((person) => [person.id, value]));

    if (type === "cell") {
      setCellPresence(next);
    } else {
      setServicePresence(next);
    }
  }

  async function saveAttendance() {
    if (!selectedCell) {
      setSaved("Escolha uma celula antes de salvar.");
      return;
    }

    const absenceTasks = cellPeople
      .map((person) => {
        const presentInCell = cellPresence[person.id] ?? person.cellAbsences === 0;
        const nextAbsences = presentInCell ? 0 : person.cellAbsences + 1;
        return { person, presentInCell, nextAbsences };
      })
      .filter(({ presentInCell, nextAbsences }) => !presentInCell && nextAbsences >= 2);

    if (!isDemoMode) {
      const cellResult = await saveCellAttendance({
        churchId: currentUser.churchId,
        cellId: selectedCell.id,
        meetingDate,
        createdBy: currentUser.id,
        visitorsCount,
        notes,
        records: cellPeople.map((person) => ({
          personId: person.id,
          present: cellPresence[person.id] ?? person.cellAbsences === 0,
        })),
      });

      if (!cellResult.ok) {
        setSaved(`Nao consegui salvar a presenca da celula: ${cellResult.error}`);
        return;
      }

      const serviceResult = await saveServiceAttendance({
        churchId: currentUser.churchId,
        serviceDate,
        title: "Culto principal",
        createdBy: currentUser.id,
        records: cellPeople.map((person) => ({
          personId: person.id,
          present: servicePresence[person.id] ?? person.servicePresent,
        })),
      });

      if (!serviceResult.ok) {
        setSaved(`Presenca da celula salva, mas o culto nao salvou: ${serviceResult.error}`);
      }

      if (cellResult.queued || serviceResult.queued) {
        setSaved("Sem internet agora. A presenca foi guardada na fila local e sera sincronizada depois.");
      }
    }

    updatePeople((current) =>
      current.map((person) => {
        if (!cellPeople.some((visiblePerson) => visiblePerson.id === person.id)) {
          return person;
        }

        const presentInCell = cellPresence[person.id] ?? person.cellAbsences === 0;
        return {
          ...person,
          cellAbsences: presentInCell ? 0 : person.cellAbsences + 1,
          servicePresent: servicePresence[person.id] ?? person.servicePresent,
        };
      }),
    );

    await Promise.all(
      absenceTasks.map(({ person, nextAbsences }) =>
        addCareTask({
          id: `ausencia-${person.id}-${meetingDate}`,
          personId: person.id,
          title: `${person.name} faltou ${nextAbsences} celulas seguidas`,
          description:
            nextAbsences >= 3
              ? "Acompanhamento urgente: a pessoa esta com tres ausencias consecutivas."
              : "Sugestao: enviar mensagem hoje e perguntar como ela esta.",
          priority: nextAbsences >= 3 ? "Urgente" : "Alta",
          due: "Hoje",
          message: `Ola, ${person.name.split(" ")[0]}! Sentimos sua falta na celula. Esta tudo bem? Estamos aqui para caminhar com voce.`,
          churchId: currentUser.churchId,
          assignedTo: person.leaderUserId || currentUser.id,
          type: "ausencia",
          persistToSupabase: !isDemoMode,
        }),
      ),
    );

    await addEvent({
      churchId: currentUser.churchId,
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "Marcou presenca",
      description: `${currentUser.name} registrou ${presentCount}/${cellPeople.length} presentes na celula ${selectedCell.name}.`,
      targetType: "report",
      targetName: `Presenca ${selectedCell.name}`,
      cellId: selectedCell.id,
      visibility: "leadership",
      persistToSupabase: !isDemoMode,
    });

    setSaved((current) =>
      current ||
      (absenceTasks.length > 0
        ? `Presenca salva. ${absenceTasks.length} cuidado(s) foram criados automaticamente.`
        : "Presenca salva. Nenhum alerta novo foi necessario."),
    );
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <div className="rounded-lg border border-white/80 bg-white/90 p-4 shadow-sm">
          <SectionHeader eyebrow="Check-in semanal" title="Presenca por celula" />
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2">
              Celula
              <select
                value={selectedCell?.id ?? ""}
                onChange={(event) => setSelectedCellId(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                {visibleCells.map((cell) => (
                  <option key={cell.id} value={cell.id}>
                    {cell.name} - {cell.meetingDay}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              Data da celula
              <input
                type="date"
                value={meetingDate}
                onChange={(event) => setMeetingDate(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              Visitantes
              <input
                type="number"
                min="0"
                value={visitorsCount}
                onChange={(event) => setVisitorsCount(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader
            eyebrow={selectedCell ? `${selectedCell.meetingDay}, ${selectedCell.meetingTime}` : "Celula"}
            title="Presenca da celula"
            action={<span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{presentCount}/{cellPeople.length}</span>}
          />
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button onClick={() => markAll(true, "cell")} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-50 text-sm font-bold text-emerald-800">
              <Check size={17} />
              Todos presentes
            </button>
            <button onClick={() => markAll(false, "cell")} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-rose-50 text-sm font-bold text-rose-800">
              <X size={17} />
              Limpar
            </button>
          </div>
          <div className="space-y-3">
            {cellPeople.map((person) => (
              <label
                key={person.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 hover:bg-white"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <PersonAvatar person={person} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-950">{person.name}</span>
                    <span className="text-sm text-slate-500">{person.stage}</span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={cellPresence[person.id] ?? person.cellAbsences === 0}
                  onChange={(event) =>
                    setCellPresence((current) => ({ ...current, [person.id]: event.target.checked }))
                  }
                  className="h-7 w-7 shrink-0 accent-emerald-700"
                  aria-label={`Presenca de ${person.name}`}
                />
              </label>
            ))}
          </div>
          <label className="mt-4 block space-y-2 text-sm font-semibold text-slate-700">
            Observacoes da reuniao
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="Ex.: bom compartilhamento, pedido de oracao, proximo passo..."
            />
          </label>
          {saved && (
            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
              {saved}
            </div>
          )}
          <button
            onClick={saveAttendance}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 hover:bg-emerald-800"
          >
            <ClipboardCheck size={18} />
            Salvar presenca
          </button>
        </div>

        <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader
            eyebrow="Culto"
            title="Presenca no culto"
            action={<span className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">{serviceCount}/{cellPeople.length}</span>}
          />
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button onClick={() => markAll(true, "service")} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sky-50 text-sm font-bold text-sky-800">
              <UsersRound size={17} />
              Todos no culto
            </button>
            <label className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-50 px-2 text-xs font-bold text-slate-700">
              <CalendarDays size={16} />
              <input
                type="date"
                value={serviceDate}
                onChange={(event) => setServiceDate(event.target.value)}
                className="w-full bg-transparent outline-none"
              />
            </label>
          </div>
          <div className="space-y-3">
            {cellPeople.map((person) => (
              <label key={person.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
                <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
                  <Church size={16} className="shrink-0 text-emerald-700" />
                  <span className="truncate">{person.name}</span>
                </span>
                <input
                  type="checkbox"
                  checked={servicePresence[person.id] ?? person.servicePresent}
                  onChange={(event) =>
                    setServicePresence((current) => ({ ...current, [person.id]: event.target.checked }))
                  }
                  className="h-6 w-6 shrink-0 accent-emerald-700"
                  aria-label={`Presenca no culto de ${person.name}`}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">Resumo rapido</p>
            <p className="mt-1 text-sm text-slate-500">
              Salvar registra celula, culto e cria tarefas automaticas para ausencias consecutivas.
            </p>
          </div>
        </div>
        </div>
      </section>
    </AppShell>
  );
}

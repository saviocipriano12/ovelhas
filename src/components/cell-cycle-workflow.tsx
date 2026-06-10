"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronRight,
  ClipboardCheck,
  MessageCircle,
  Send,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { PersonAvatar } from "@/components/person-avatar";
import { SectionHeader } from "@/components/section-header";
import { getVisibleCells, getVisiblePeople } from "@/lib/access-control";
import { getNextMeetingDate, rsvpLabel, rsvpTone } from "@/lib/cell-schedule";
import {
  saveCellAttendance,
  saveServiceAttendance,
  useActivityEvents,
  useCareTasks,
  useCellReports,
  useCellRsvps,
  useCells,
  useInvites,
  useLocalPeople,
} from "@/lib/local-store";

type CycleStep = "prepare" | "meeting" | "close";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstName(name: string) {
  return name.split(" ")[0] || name;
}

function whatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

const steps: { id: CycleStep; label: string; description: string }[] = [
  { id: "prepare", label: "Preparar", description: "Confirmacoes e pessoas que precisam de contato." },
  { id: "meeting", label: "Reuniao", description: "Presenca da celula e do culto no mesmo lugar." },
  { id: "close", label: "Fechar", description: "Relatorio enviado para supervisor, pastor e admin." },
];

export default function TodayCellPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { people, addPerson, refreshPeople, updatePeople } = useLocalPeople();
  const { rsvps } = useCellRsvps(currentUser.churchId);
  const { addCareTask } = useCareTasks();
  const { addReport } = useCellReports();
  const { addEvent } = useActivityEvents();
  const { createInvite } = useInvites();
  const visibleCells = getVisibleCells(currentUser, cells).filter((cell) => cell.active);
  const visiblePeople = getVisiblePeople(currentUser, people);
  const [selectedCellId, setSelectedCellId] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [serviceDate, setServiceDate] = useState(todayIso());
  const [step, setStep] = useState<CycleStep>("meeting");
  const [cellPresence, setCellPresence] = useState<Record<string, boolean>>({});
  const [servicePresence, setServicePresence] = useState<Record<string, boolean>>({});
  const [visitorsCount, setVisitorsCount] = useState(0);
  const [decisionsCount, setDecisionsCount] = useState(0);
  const [highlights, setHighlights] = useState("");
  const [needs, setNeeds] = useState("");
  const [prayerRequests, setPrayerRequests] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorInviteLink, setVisitorInviteLink] = useState("");
  const [visitorInvitePhone, setVisitorInvitePhone] = useState("");
  const [supervisorVisited, setSupervisorVisited] = useState(false);
  const [supervisorVisitNotes, setSupervisorVisitNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedCell = visibleCells.find((cell) => cell.id === selectedCellId) ?? visibleCells[0];
  const activeMeetingDate = meetingDate || (selectedCell ? getNextMeetingDate(selectedCell.meetingDay) : todayIso());
  const cellPeople = visiblePeople.filter((person) => person.cellId === selectedCell?.id);
  const rsvpsByPerson = new Map(
    rsvps
      .filter((rsvp) => rsvp.cellId === selectedCell?.id && rsvp.meetingDate === activeMeetingDate)
      .map((rsvp) => [rsvp.personId, rsvp]),
  );

  function defaultCellPresence(personId: string, fallback: boolean) {
    const rsvp = rsvpsByPerson.get(personId);

    if (rsvp?.response === "yes") {
      return true;
    }

    if (rsvp?.response === "no") {
      return false;
    }

    return fallback;
  }

  const presentCount = cellPeople.filter((person) => cellPresence[person.id] ?? defaultCellPresence(person.id, false)).length;
  const serviceCount = cellPeople.filter((person) => servicePresence[person.id] ?? person.servicePresent).length;
  const confirmedCount = Array.from(rsvpsByPerson.values()).filter((rsvp) => rsvp.response === "yes").length;
  const maybeCount = Array.from(rsvpsByPerson.values()).filter((rsvp) => rsvp.response === "maybe").length;
  const noCount = Array.from(rsvpsByPerson.values()).filter((rsvp) => rsvp.response === "no").length;
  const noResponseCount = Math.max(cellPeople.length - rsvpsByPerson.size, 0);
  const peopleNeedingCare = cellPeople.filter(
    (person) => person.cellAbsences >= 1 || person.progress < 20 || !rsvpsByPerson.has(person.id),
  );

  function markAll(value: boolean, type: "cell" | "service") {
    const next = Object.fromEntries(cellPeople.map((person) => [person.id, value]));

    if (type === "cell") {
      setCellPresence(next);
    } else {
      setServicePresence(next);
    }
  }

  function setPersonPresence(personId: string, value: boolean, type: "cell" | "service") {
    if (type === "cell") {
      setCellPresence((current) => ({ ...current, [personId]: value }));
      return;
    }

    setServicePresence((current) => ({ ...current, [personId]: value }));
  }

  async function addVisitorToCell() {
    if (!selectedCell || !visitorName.trim() || !visitorPhone.trim()) {
      setFeedback("Informe nome e WhatsApp do visitante.");
      return;
    }

    const result = await addPerson({
      name: visitorName.trim(),
      phone: visitorPhone.trim(),
      stage: "Visitante",
      neighborhood: selectedCell.neighborhood,
      createdByUserId: currentUser.id,
      leaderUserId: selectedCell.leaderUserId || currentUser.id,
      churchId: currentUser.churchId,
      cellId: selectedCell.id,
      cellName: selectedCell.name,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok || !result.person) {
      setFeedback(`Nao consegui cadastrar visitante: ${result.error}`);
      return;
    }

    const inviteResult = await createInvite({
      churchId: currentUser.churchId,
      name: result.person.name,
      email: result.person.email,
      role: "member",
      cellId: result.person.cellId,
      personId: result.person.id,
      createdBy: currentUser.id,
      persistToSupabase: !isDemoMode,
    });

    setVisitorsCount((current) => current + 1);
    const savedVisitorPhone = visitorPhone;
    setVisitorName("");
    setVisitorPhone("");
    await refreshPeople();

    if (inviteResult.ok && inviteResult.invite && typeof window !== "undefined") {
      const link = `${window.location.origin}/convite/${inviteResult.invite.token}`;
      setVisitorInviteLink(link);
      setVisitorInvitePhone(savedVisitorPhone);
      setFeedback(`${result.person.name} foi cadastrado como visitante. Convite pronto para a proxima celula.`);
      return;
    }

    setFeedback(`${result.person.name} foi cadastrado, mas o convite nao foi gerado: ${inviteResult.error}`);
  }

  async function finishCycle() {
    if (!selectedCell || saving) {
      return;
    }

    setSaving(true);
    setFeedback("");

    const absenceTasks = cellPeople
      .map((person) => {
        const present = cellPresence[person.id] ?? defaultCellPresence(person.id, false);
        return { person, present, nextAbsences: present ? 0 : person.cellAbsences + 1 };
      })
      .filter(({ present, nextAbsences }) => !present && nextAbsences >= 2);

    if (!isDemoMode) {
      const attendanceResult = await saveCellAttendance({
        churchId: currentUser.churchId,
        cellId: selectedCell.id,
        meetingDate: activeMeetingDate,
        createdBy: currentUser.id,
        visitorsCount,
        notes: highlights,
        records: cellPeople.map((person) => ({
          personId: person.id,
          present: cellPresence[person.id] ?? defaultCellPresence(person.id, false),
        })),
      });

      if (!attendanceResult.ok) {
        setSaving(false);
        setFeedback(`Nao consegui salvar a presenca: ${attendanceResult.error}`);
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
        setFeedback(`Presenca da celula salva, mas o culto nao salvou: ${serviceResult.error}`);
      }
    }

    await addReport({
      churchId: selectedCell.churchId,
      cellId: selectedCell.id,
      cellName: selectedCell.name,
      leaderUserId: selectedCell.leaderUserId,
      leaderName: selectedCell.leaderName,
      supervisorUserId: selectedCell.supervisorUserId,
      meetingDate: activeMeetingDate,
      presentCount,
      visitorsCount,
      serviceCount,
      decisionsCount,
      highlights,
      needs,
      prayerRequests,
      supervisorVisited,
      supervisorVisitNotes,
      persistToSupabase: !isDemoMode,
    });

    updatePeople((current) =>
      current.map((person) => {
        if (!cellPeople.some((item) => item.id === person.id)) {
          return person;
        }

        const present = cellPresence[person.id] ?? defaultCellPresence(person.id, false);
        return {
          ...person,
          cellAbsences: present ? 0 : person.cellAbsences + 1,
          servicePresent: servicePresence[person.id] ?? person.servicePresent,
        };
      }),
    );

    await Promise.all(
      absenceTasks.map(({ person, nextAbsences }) =>
        addCareTask({
          id: `ciclo-${selectedCell.id}-${person.id}-${activeMeetingDate}`,
          personId: person.id,
          title: `${person.name} faltou ${nextAbsences} celulas seguidas`,
          description:
            nextAbsences >= 3
              ? "Acompanhamento urgente: registrar contato e sinalizar para a supervisao."
              : "Sugestao: enviar mensagem ainda hoje e entender o motivo da ausencia.",
          priority: nextAbsences >= 3 ? "Urgente" : "Alta",
          due: "Hoje",
          message: `Ola, ${firstName(person.name)}! Sentimos sua falta na celula. Esta tudo bem? Estamos aqui para caminhar com voce.`,
          churchId: currentUser.churchId,
          assignedTo: person.leaderUserId || selectedCell.leaderUserId || currentUser.id,
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
      action: "Fechou ciclo da celula",
      description: `${selectedCell.name}: ${presentCount}/${cellPeople.length} presentes, ${visitorsCount} visitantes, ${decisionsCount} decisoes e supervisao ${supervisorVisited ? "presente" : "nao registrada"}.`,
      targetType: "report",
      targetName: `Ciclo ${selectedCell.name}`,
      cellId: selectedCell.id,
      visibility: "leadership",
      persistToSupabase: !isDemoMode,
    });

    setSaving(false);
    setFeedback(
      absenceTasks.length > 0
        ? `Ciclo fechado. ${absenceTasks.length} cuidado(s) foram criados automaticamente.`
        : "Ciclo fechado e enviado para a lideranca.",
    );
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-4 pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/celulas"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </Link>
          <SectionHeader eyebrow="Ciclo semanal" title="Presenca da celula" />
        </div>

        <div className="rounded-[28px] bg-slate-950 p-4 text-white shadow-xl shadow-slate-950/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-emerald-200">Fluxo inteligente</p>
              <h2 className="mt-1 text-2xl font-bold leading-tight">{selectedCell?.name ?? "Nenhuma celula"}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Prepare, registre e envie o resumo para a hierarquia sem sair desta tela.
              </p>
            </div>
            <CalendarCheck className="shrink-0 text-emerald-200" size={30} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="col-span-2">
              <span className="text-[11px] font-black uppercase text-slate-400">Celula</span>
              <select
                value={selectedCell?.id ?? ""}
                onChange={(event) => {
                  const nextCell = visibleCells.find((cell) => cell.id === event.target.value);
                  setSelectedCellId(event.target.value);
                  setMeetingDate(nextCell ? getNextMeetingDate(nextCell.meetingDay) : "");
                  setCellPresence({});
                  setServicePresence({});
                }}
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-3 text-sm font-bold text-white outline-none"
              >
                {visibleCells.map((cell) => (
                  <option key={cell.id} value={cell.id} className="text-slate-950">
                    {cell.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[11px] font-black uppercase text-slate-400">Celula</span>
              <input
                type="date"
                value={activeMeetingDate}
                onChange={(event) => setMeetingDate(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-3 text-sm font-bold text-white outline-none"
              />
            </label>
            <label>
              <span className="text-[11px] font-black uppercase text-slate-400">Culto</span>
              <input
                type="date"
                value={serviceDate}
                onChange={(event) => setServiceDate(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-3 text-sm font-bold text-white outline-none"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/80 bg-white/90 p-2 shadow-sm">
          {steps.map((item) => {
            const active = step === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setStep(item.id)}
                className={`rounded-2xl px-2 py-3 text-center text-xs font-black ${
                  active ? "bg-emerald-900 text-white shadow-lg shadow-emerald-900/15" : "text-slate-500"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {step === "prepare" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Confirmaram", confirmedCount, "bg-emerald-500"],
                ["Talvez", maybeCount, "bg-amber-500"],
                ["Nao vao", noCount, "bg-rose-500"],
                ["Sem resposta", noResponseCount, "bg-slate-500"],
              ].map(([label, value, accent]) => (
                <div key={label} className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
                  <div className={`mt-3 h-1.5 rounded-full ${accent}`} />
                </div>
              ))}
            </div>

            <section className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-sm">
              <SectionHeader eyebrow="Antes da reuniao" title="Pessoas para observar" />
              <div className="space-y-3">
                {peopleNeedingCare.map((person) => {
                  const rsvp = rsvpsByPerson.get(person.id);
                  return (
                    <article key={person.id} className="rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <PersonAvatar person={person} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-950">{person.name}</p>
                            <p className="text-xs font-semibold text-slate-500">
                              {person.cellAbsences} falta(s) · {person.progress}% discipulado
                            </p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-xl px-2 py-1 text-[11px] font-black ${rsvpTone(rsvp?.response)}`}>
                          {rsvpLabel(rsvp?.response)}
                        </span>
                      </div>
                      <a
                        href={whatsappUrl(
                          person.phone,
                          `Ola, ${firstName(person.name)}! Passando para confirmar se voce estara na celula esta semana.`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-900 text-sm font-bold text-white"
                      >
                        <MessageCircle size={17} />
                        Chamar no WhatsApp
                      </a>
                    </article>
                  );
                })}
                {peopleNeedingCare.length === 0 && (
                  <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                    A celula esta pronta para a reuniao. Nenhum alerta antes do encontro.
                  </p>
                )}
              </div>
            </section>

            <button
              onClick={() => setStep("meeting")}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-emerald-900 text-sm font-black text-white shadow-lg shadow-emerald-900/15"
            >
              Ir para presenca
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === "meeting" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <button
                onClick={() => markAll(true, "cell")}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-900 text-sm font-black text-white"
              >
                <Check size={17} />
                Todos presentes
              </button>
              <button
                onClick={() => markAll(false, "cell")}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-slate-600 shadow-sm"
              >
                Limpar celula
              </button>
              <button
                onClick={() => markAll(true, "service")}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-sky-700 text-sm font-black text-white"
              >
                <UsersRound size={17} />
                Todos no culto
              </button>
              <button
                onClick={() => markAll(false, "service")}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-slate-600 shadow-sm"
              >
                Limpar culto
              </button>
            </div>

            <section className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-sm">
              <SectionHeader
                eyebrow={`${presentCount}/${cellPeople.length} presentes`}
                title="Lista da celula"
                action={<span className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-900">{serviceCount} culto</span>}
              />
              <div className="space-y-3">
                {cellPeople.map((person) => {
                  const rsvp = rsvpsByPerson.get(person.id);
                  const isCellPresent = cellPresence[person.id] ?? defaultCellPresence(person.id, false);
                  const isServicePresent = servicePresence[person.id] ?? person.servicePresent;

                  return (
                    <article key={person.id} className="rounded-[24px] border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <PersonAvatar person={person} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-950">{person.name}</p>
                            <span className={`mt-1 inline-flex rounded-xl px-2 py-1 text-[11px] font-black ${rsvpTone(rsvp?.response)}`}>
                              {rsvpLabel(rsvp?.response)}
                            </span>
                          </div>
                        </div>
                        <div className="hidden shrink-0 gap-2 sm:flex">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${isCellPresent ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-500"}`}>
                            {isCellPresent ? "Na celula" : "Ausente"}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${isServicePresent ? "bg-sky-100 text-sky-900" : "bg-slate-200 text-slate-500"}`}>
                            {isServicePresent ? "Foi ao culto" : "Nao foi"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        <div className="rounded-2xl bg-white p-2">
                          <p className="px-2 pb-2 text-[11px] font-black uppercase text-slate-400">Presenca na celula</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setPersonPresence(person.id, true, "cell")}
                              className={`min-h-12 rounded-xl px-3 text-sm font-black transition ${
                                isCellPresent ? "bg-emerald-900 text-white shadow-lg shadow-emerald-900/15" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              Presente
                            </button>
                            <button
                              type="button"
                              onClick={() => setPersonPresence(person.id, false, "cell")}
                              className={`min-h-12 rounded-xl px-3 text-sm font-black transition ${
                                !isCellPresent ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              Ausente
                            </button>
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white p-2">
                          <p className="px-2 pb-2 text-[11px] font-black uppercase text-slate-400">Presenca no culto</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setPersonPresence(person.id, true, "service")}
                              className={`min-h-12 rounded-xl px-3 text-sm font-black transition ${
                                isServicePresent ? "bg-sky-700 text-white shadow-lg shadow-sky-700/15" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              Foi
                            </button>
                            <button
                              type="button"
                              onClick={() => setPersonPresence(person.id, false, "service")}
                              className={`min-h-12 rounded-xl px-3 text-sm font-black transition ${
                                !isServicePresent ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              Nao foi
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {cellPeople.length === 0 && (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    <p>Esta celula ainda nao tem pessoas vinculadas.</p>
                    <Link href="/pessoas" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-900 px-4 text-sm font-black text-white">
                      Cadastrar pessoas
                    </Link>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
              <SectionHeader eyebrow="Visitante" title="Cadastrar e convidar" />
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  value={visitorName}
                  onChange={(event) => setVisitorName(event.target.value)}
                  className="field-control"
                  placeholder="Nome do visitante"
                />
                <input
                  value={visitorPhone}
                  onChange={(event) => setVisitorPhone(event.target.value)}
                  inputMode="tel"
                  className="field-control"
                  placeholder="WhatsApp"
                />
                <button
                  type="button"
                  onClick={addVisitorToCell}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-4 text-sm font-black text-white"
                >
                  <UserRoundPlus size={18} />
                  Adicionar
                </button>
              </div>
              {visitorInviteLink ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <p className="break-all rounded-2xl bg-white/85 p-3 text-xs font-bold text-emerald-900">{visitorInviteLink}</p>
                  <a
                    href={whatsappUrl(visitorInvitePhone, `Ola! Aqui esta o convite para entrar no Ovelhas e acompanhar a proxima celula: ${visitorInviteLink}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-4 text-sm font-black text-white"
                  >
                    <Send size={16} />
                    Enviar
                  </a>
                </div>
              ) : null}
            </section>

            <button
              onClick={() => setStep("close")}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-emerald-900 text-sm font-black text-white shadow-lg shadow-emerald-900/15"
            >
              Montar relatorio
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === "close" && (
          <div className="space-y-3">
            <section className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-sm">
              <SectionHeader eyebrow="Resumo final" title="Fechamento da celula" />
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="text-xs font-black uppercase text-slate-400">Visitantes</span>
                  <input
                    type="number"
                    min="0"
                    value={visitorsCount}
                    onChange={(event) => setVisitorsCount(Number(event.target.value))}
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-emerald-500"
                  />
                </label>
                <label>
                  <span className="text-xs font-black uppercase text-slate-400">Decisoes</span>
                  <input
                    type="number"
                    min="0"
                    value={decisionsCount}
                    onChange={(event) => setDecisionsCount(Number(event.target.value))}
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-emerald-500"
                  />
                </label>
              </div>
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-950">
                  <input
                    type="checkbox"
                    checked={supervisorVisited}
                    onChange={(event) => setSupervisorVisited(event.target.checked)}
                    className="mt-1 h-5 w-5 accent-emerald-700"
                  />
                  <span>
                    Supervisor esteve nesta celula
                    <span className="mt-1 block text-xs font-semibold text-emerald-700">
                      Essa informacao aparece no relatorio enviado para a lideranca.
                    </span>
                  </span>
                </label>
                <textarea
                  value={supervisorVisitNotes}
                  onChange={(event) => setSupervisorVisitNotes(event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Observacao sobre a visita do supervisor"
                />
                <textarea
                  value={highlights}
                  onChange={(event) => setHighlights(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Destaques da reuniao"
                />
                <textarea
                  value={needs}
                  onChange={(event) => setNeeds(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Necessidades de acompanhamento"
                />
                <textarea
                  value={prayerRequests}
                  onChange={(event) => setPrayerRequests(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Pedidos de oracao"
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                  <p className="text-2xl font-black text-emerald-950">{presentCount}</p>
                  <p className="text-[11px] font-bold text-emerald-800">presentes</p>
                </div>
                <div className="rounded-2xl bg-sky-50 p-3 text-center">
                  <p className="text-2xl font-black text-sky-950">{serviceCount}</p>
                  <p className="text-[11px] font-bold text-sky-800">culto</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3 text-center">
                  <p className="text-2xl font-black text-amber-950">{visitorsCount}</p>
                  <p className="text-[11px] font-bold text-amber-800">visitantes</p>
                </div>
              </div>
            </section>

            {feedback && (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
                {feedback}
              </div>
            )}

            <button
              onClick={finishCycle}
              disabled={saving || !selectedCell}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-slate-950 text-sm font-black text-white shadow-xl shadow-slate-950/15 disabled:opacity-60"
            >
              {saving ? <ClipboardCheck size={18} /> : <Send size={18} />}
              {saving ? "Fechando ciclo..." : "Fechar ciclo e enviar"}
            </button>
          </div>
        )}
      </section>
    </AppShell>
  );
}

"use client";

import Link from "next/link";
import { Bell, CalendarCheck, CheckCircle2, ExternalLink, Heart, Lock, MessageCircle, PlayCircle, Save, UserRound, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { ChurchNoticeCard } from "@/components/church-notice-card";
import { PersonAvatar } from "@/components/person-avatar";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { getNextMeetingDate, rsvpLabel, rsvpTone, shouldAskForRsvp } from "@/lib/cell-schedule";
import { getScopedActivityEvents, getScopedPrayerRequests } from "@/lib/access-control";
import { isChurchNotice } from "@/lib/church-notices";
import { saveVideoReflection, useActivityEvents, useCellRsvps, useCells, useDiscipleship, useLocalPeople, usePrayerRequests } from "@/lib/local-store";
import { getVideoEmbedUrl, isEmbeddableVideo } from "@/lib/video";

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function prayerStatusLabel(status: "open" | "prayed" | "answered") {
  if (status === "answered") {
    return "Respondido";
  }

  if (status === "prayed") {
    return "Orado";
  }

  return "Aberto";
}

function prayerStatusTone(status: "open" | "prayed" | "answered") {
  if (status === "answered") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "prayed") {
    return "bg-sky-100 text-sky-800";
  }

  return "bg-amber-100 text-amber-900";
}

function buildNextSteps(input: {
  hasCell: boolean;
  hasTrack: boolean;
  progress: number;
  absences: number;
  stage: string;
}) {
  const items: { title: string; description: string; tone: string }[] = [];

  if (!input.hasCell) {
    items.push({
      title: "Regularizar sua celula",
      description: "Sua conta precisa ficar vinculada a uma celula para receber agenda, cuidado e avisos corretos.",
      tone: "bg-amber-50 text-amber-950",
    });
  }

  if (!input.hasTrack) {
    items.push({
      title: "Aguardar liberacao do discipulado",
      description: "Sua lideranca ainda nao liberou uma trilha para voce. Assim que liberar, ela aparece aqui.",
      tone: "bg-slate-50 text-slate-800",
    });
  } else if (input.progress < 100) {
    items.push({
      title: "Continuar sua trilha",
      description: input.progress < 30 ? "Comece a trilha desta semana para firmar sua caminhada." : "Volte para a proxima aula e mantenha constancia no discipulado.",
      tone: "bg-emerald-50 text-emerald-950",
    });
  }

  if (input.absences >= 2) {
    items.push({
      title: "Retomar constancia na celula",
      description: "Sua lideranca provavelmente vai te procurar. Responda e alinhe seu retorno com tranquilidade.",
      tone: "bg-rose-50 text-rose-900",
    });
  }

  if (input.stage.toLowerCase().includes("visitante")) {
    items.push({
      title: "Dar o proximo passo",
      description: "Participe da proxima celula e converse com sua lideranca sobre integracao e acompanhamento.",
      tone: "bg-sky-50 text-sky-950",
    });
  }

  return items.slice(0, 4);
}

const careOptions = [
  { value: "visita", label: "Preciso de visita" },
  { value: "aconselhamento", label: "Preciso conversar" },
  { value: "ajuda", label: "Preciso de ajuda" },
  { value: "oracao", label: "Preciso de oracao" },
] as const;

export default function MemberDiscipleshipPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people, updatePerson } = useLocalPeople();
  const { cells } = useCells();
  const { tracks, videos, accesses, progress, updateVideoProgress } = useDiscipleship();
  const { events, addEvent } = useActivityEvents();
  const { requests, addPrayerRequest } = usePrayerRequests();
  const { rsvps, saveRsvp } = useCellRsvps(currentUser.churchId);
  const [feedback, setFeedback] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [reflection, setReflection] = useState("");
  const [rsvpNote, setRsvpNote] = useState("");
  const [rsvpPopupDismissed, setRsvpPopupDismissed] = useState(false);
  const [careType, setCareType] = useState<(typeof careOptions)[number]["value"]>("visita");
  const [careText, setCareText] = useState("");
  const member =
    people.find((person) => person.personUserId === currentUser.id || person.id === currentUser.personId);

  if (!member) {
    return (
      <AppShell>
        <section className="mx-auto max-w-xl">
          <section className="rounded-[24px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10">
            <h1 className="text-2xl font-semibold leading-tight">Perfil de membro nao vinculado</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Sua conta entrou corretamente, mas ainda nao existe uma pessoa vinculada a este usuario. Peça para sua lideranca ajustar seu cadastro.
            </p>
            <Link href="/dashboard" className="mt-5 flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-bold text-slate-950">
              Voltar
            </Link>
          </section>
        </section>
      </AppShell>
    );
  }

  const memberCell = cells.find((cell) => cell.id === member.cellId);
  const nextMeetingDate = memberCell ? getNextMeetingDate(memberCell.meetingDay) : "";
  const currentRsvp = rsvps.find(
    (rsvp) => rsvp.personId === member.id && rsvp.cellId === member.cellId && rsvp.meetingDate === nextMeetingDate,
  );
  const showRsvpPopup = Boolean(memberCell && nextMeetingDate && shouldAskForRsvp(nextMeetingDate) && !currentRsvp && !rsvpPopupDismissed);
  const memberAccesses = accesses.filter((access) => access.personId === member.id && access.status === "active");
  const activeAccess = memberAccesses[0];
  const activeTrack = tracks.find((track) => track.id === activeAccess?.trackId);
  const trackVideos = videos
    .filter((video) => video.trackId === activeTrack?.id && video.active)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const progressByVideo = new Map(progress.filter((item) => item.personId === member.id).map((item) => [item.videoId, item]));
  const trackProgress = trackVideos.length
    ? Math.round(
        trackVideos.reduce((total, video) => total + (progressByVideo.get(video.id)?.progressPercent ?? 0), 0) /
          trackVideos.length,
      )
    : 0;
  const nextVideo =
    trackVideos.find((video) => (progressByVideo.get(video.id)?.progressPercent ?? 0) < 100) ?? trackVideos[0];
  const selectedVideo = trackVideos.find((video) => video.id === selectedVideoId) ?? nextVideo;
  const selectedProgress = selectedVideo ? progressByVideo.get(selectedVideo.id)?.progressPercent ?? 0 : 0;
  const memberNotices = getScopedActivityEvents(currentUser, events, cells, people, isDemoMode)
    .filter(isChurchNotice)
    .slice(0, 2);
  const visibleRequests = getScopedPrayerRequests(currentUser, requests, cells, people, isDemoMode);
  const memberRequests = visibleRequests
    .filter((request) => request.personId === member.id || request.createdBy === currentUser.id)
    .slice(0, 4);
  const memberEvents = getScopedActivityEvents(currentUser, events, cells, people, isDemoMode)
    .filter((event) => event.personId === member.id || event.actorUserId === currentUser.id)
    .slice(0, 5);
  const personalAgenda = [
    ...(memberCell
      ? [
          {
            id: `agenda-cell-${memberCell.id}`,
            title: memberCell.name,
            description: `${memberCell.meetingDay}, ${memberCell.meetingTime}`,
            support: nextMeetingDate,
          },
        ]
      : []),
    ...(selectedVideo
      ? [
          {
            id: `agenda-video-${selectedVideo.id}`,
            title: "Continuar discipulado",
            description: selectedVideo.title,
            support: `${selectedProgress}% concluido`,
          },
        ]
      : []),
  ];
  const nextSteps = buildNextSteps({
    hasCell: Boolean(memberCell),
    hasTrack: Boolean(activeTrack),
    progress: trackProgress,
    absences: member.cellAbsences,
    stage: member.stage,
  });
  const journeyItems = [
    ...(currentRsvp
      ? [
          {
            id: `rsvp-${currentRsvp.id}`,
            title: "Confirmacao da proxima celula",
            description: `Voce respondeu: ${rsvpLabel(currentRsvp.response)}.`,
            createdAt: currentRsvp.updatedAt,
          },
        ]
      : []),
    ...memberRequests.map((request) => ({
      id: request.id,
      title: request.title,
      description: request.request,
      createdAt: request.updatedAt || request.createdAt,
    })),
    ...memberEvents.map((event) => ({
      id: event.id,
      title: event.action,
      description: event.description,
      createdAt: event.createdAt,
    })),
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 6);

  async function saveVideoProgress(videoId: string, progressPercent: number) {
    if (!member) {
      return;
    }

    const video = trackVideos.find((item) => item.id === videoId);
    if (!video) {
      return;
    }

    const result = await updateVideoProgress({
      personId: member.id,
      videoId,
      progressPercent,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setFeedback(`Nao consegui salvar seu progresso: ${result.error}`);
      return;
    }

    if (progressPercent >= 100) {
      await addEvent({
        churchId: member.churchId,
        actorUserId: currentUser.id,
        actorName: member.name,
        actorRole: currentUser.role,
        action: "Concluiu video",
        description: `${member.name} concluiu a aula ${video.title}.`,
        targetType: "video",
        targetId: video.id,
        targetName: video.title,
        personId: member.id,
        cellId: member.cellId,
        visibility: "cell",
        persistToSupabase: !isDemoMode,
      });
    }

    setFeedback(progressPercent >= 100 ? `Aula concluida: ${video.title}.` : `Progresso salvo em ${progressPercent}%.`);
  }

  async function saveReflection() {
    if (!member || !selectedVideo) {
      return;
    }

    if (isDemoMode && typeof window !== "undefined") {
      window.localStorage.setItem(`ovelhas:reflection:${member.id}:${selectedVideo.id}`, reflection);
      setFeedback("Resposta salva no aparelho.");
      return;
    }

    const result = await saveVideoReflection({
      personId: member.id,
      videoId: selectedVideo.id,
      answer: reflection,
    });

    setFeedback(result.ok ? "Resposta salva para sua lideranca acompanhar." : `Nao consegui salvar a resposta: ${result.error}`);
  }

  async function requestCare() {
    if (!member || !careText.trim()) {
      setFeedback("Escreva o que esta acontecendo para sua lideranca te ajudar com clareza.");
      return;
    }

    const selectedCare = careOptions.find((option) => option.value === careType);
    const result = await addPrayerRequest({
      churchId: member.churchId,
      personId: member.id,
      cellId: member.cellId,
      title: selectedCare ? selectedCare.label : "Pedido de cuidado",
      request: careText.trim(),
      visibility: "leadership",
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok || !result.request) {
      setFeedback(`Nao consegui registrar seu pedido de cuidado: ${result.error}`);
      return;
    }

    await addEvent({
      churchId: member.churchId,
      actorUserId: currentUser.id,
      actorName: member.name,
      actorRole: currentUser.role,
      action: "Pediu cuidado",
      description: `${member.name} registrou: ${selectedCare?.label ?? "Pedido de cuidado"}.`,
      targetType: "care",
      targetId: result.request.id,
      targetName: result.request.title,
      personId: member.id,
      cellId: member.cellId,
      visibility: "leadership",
      persistToSupabase: !isDemoMode,
    });

    setCareText("");
    setFeedback("Pedido de cuidado enviado para sua lideranca acompanhar.");
  }

  async function respondRsvp(response: "yes" | "no" | "maybe") {
    if (!member || !memberCell || !nextMeetingDate) {
      return;
    }

    const result = await saveRsvp({
      churchId: member.churchId,
      cellId: member.cellId,
      personId: member.id,
      personName: member.name,
      meetingDate: nextMeetingDate,
      response,
      note: rsvpNote,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setFeedback(`Nao consegui salvar sua confirmacao: ${result.error}`);
      return;
    }

    await addEvent({
      churchId: member.churchId,
      actorUserId: currentUser.id,
      actorName: member.name,
      actorRole: currentUser.role,
      action: "Confirmou celula",
      description: `${member.name}: ${rsvpLabel(response)} na celula ${memberCell.name}.`,
      targetType: "cell",
      targetId: memberCell.id,
      targetName: memberCell.name,
      personId: member.id,
      cellId: member.cellId,
      visibility: "cell",
      persistToSupabase: !isDemoMode,
    });

    setFeedback(`Confirmacao salva: ${rsvpLabel(response)}.`);
    setRsvpPopupDismissed(true);
  }

  async function saveMemberProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const phone = normalizePhone(String(formData.get("phone") || member.phone || ""));
    const familyPhone = normalizePhone(String(formData.get("familyPhone") || member.familyPhone || ""));
    const email = String(formData.get("email") || member.email || "").trim();

    if (phone && phone.length < 10) {
      setFeedback("Informe um WhatsApp valido com DDD.");
      return;
    }

    if (familyPhone && familyPhone.length < 10) {
      setFeedback("Informe um telefone familiar valido com DDD ou deixe o campo vazio.");
      return;
    }

    if (email && !isValidEmail(email)) {
      setFeedback("Informe um email valido.");
      return;
    }

    const result = await updatePerson(member.id, {
      name: String(formData.get("name") || member.name).trim(),
      phone,
      email,
      birthDate: String(formData.get("birthDate") || member.birthDate || ""),
      address: String(formData.get("address") || member.address || ""),
      familyPhone,
      photoUrl: String(formData.get("photoUrl") || member.photoUrl || ""),
      persistToSupabase: !isDemoMode,
    });

    setFeedback(result.ok ? "Perfil atualizado." : `Nao consegui atualizar seu perfil: ${result.error}`);
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl animate-enter space-y-5 pb-6">
        <header className="rounded-[26px] border border-white/80 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <PersonAvatar person={member} size="md" />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-emerald-700">Membro</p>
              <h1 className="truncate text-xl font-black text-slate-950">{member.name}</h1>
              <p className="truncate text-sm font-semibold text-slate-500">{memberCell?.name ?? "Sem celula vinculada"}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            <Link href="/meu-discipulado" className="rounded-2xl bg-emerald-900 p-3 text-center text-xs font-black text-white">
              <UserRound className="mx-auto mb-1" size={17} />
              Inicio
            </Link>
            <Link href="/oracao" className="rounded-2xl bg-slate-50 p-3 text-center text-xs font-black text-slate-700">
              <Heart className="mx-auto mb-1" size={17} />
              Oracao
            </Link>
            <Link href="/notificacoes" className="rounded-2xl bg-slate-50 p-3 text-center text-xs font-black text-slate-700">
              <Bell className="mx-auto mb-1" size={17} />
              Avisos
            </Link>
            <a href="#perfil" className="rounded-2xl bg-slate-50 p-3 text-center text-xs font-black text-slate-700">
              <UserRound className="mx-auto mb-1" size={17} />
              Perfil
            </a>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-emerald-700">Meu processo</p>
            <h2 className="mt-1 text-lg font-black leading-tight text-slate-950">{member.stage}</h2>
            <p className="mt-2 text-xs font-bold text-slate-500">{member.status}</p>
          </div>
          <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-emerald-700">Lider</p>
            <h2 className="mt-1 truncate text-lg font-black leading-tight text-slate-950">{member.leader}</h2>
            <p className="mt-2 text-xs font-bold text-slate-500">Responsavel pelo cuidado</p>
          </div>
          <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-sky-700">Culto</p>
            <h2 className="mt-1 text-lg font-black leading-tight text-slate-950">{member.servicePresent ? "Presente" : "Acompanhar"}</h2>
            <p className="mt-2 text-xs font-bold text-slate-500">Ultimo registro no culto</p>
          </div>
          <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-violet-700">Discipulado</p>
            <h2 className="mt-1 text-lg font-black leading-tight text-slate-950">{trackProgress}%</h2>
            <p className="mt-2 text-xs font-bold text-slate-500">{activeTrack?.title ?? "Aguardando liberacao"}</p>
          </div>
        </section>

        {memberNotices.length > 0 && (
          <section className="rounded-[28px] border border-white/80 bg-white/60 p-3 shadow-sm">
            <SectionHeader eyebrow="Avisos" title="Comunicados para voce" />
            <div className="grid gap-3">
              {memberNotices.map((event) => (
                <ChurchNoticeCard key={event.id} event={event} compact />
              ))}
            </div>
          </section>
        )}

        {showRsvpPopup && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center">
            <section className="mx-auto w-full max-w-xl rounded-[28px] bg-white p-5 shadow-2xl shadow-slate-950/25">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                  <CalendarCheck size={24} />
                </span>
                <button onClick={() => setRsvpPopupDismissed(true)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <X size={18} />
                </button>
              </div>
              <h2 className="mt-4 text-2xl font-semibold leading-tight text-slate-950">Voce vai estar na celula?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {memberCell?.name}, {memberCell?.meetingDay} as {memberCell?.meetingTime}. Sua resposta ajuda o lider a preparar a lista da semana.
              </p>
              <textarea
                value={rsvpNote}
                onChange={(event) => setRsvpNote(event.target.value)}
                placeholder="Observacao opcional"
                className="mt-4 min-h-20 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button onClick={() => respondRsvp("yes")} className="min-h-12 rounded-2xl bg-emerald-900 px-3 text-sm font-bold text-white">
                  Vou
                </button>
                <button onClick={() => respondRsvp("maybe")} className="min-h-12 rounded-2xl bg-amber-100 px-3 text-sm font-bold text-amber-900">
                  Talvez
                </button>
                <button onClick={() => respondRsvp("no")} className="min-h-12 rounded-2xl bg-rose-100 px-3 text-sm font-bold text-rose-800">
                  Nao vou
                </button>
              </div>
            </section>
          </div>
        )}

        <section className="rounded-[26px] bg-slate-950 p-5 text-white shadow-lg shadow-slate-900/10">
          <p className="text-sm font-semibold text-emerald-200">Ola, {member.name}</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">Sua caminhada continua hoje.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Assista ao proximo video, responda com calma e fale com seu lider sempre que precisar.
          </p>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>{activeTrack?.title ?? "Nenhuma trilha liberada"}</span>
              <span className="font-bold text-emerald-200">{trackProgress}%</span>
            </div>
            <ProgressBar value={trackProgress} />
          </div>
        </section>

        {memberCell && (
          <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Proxima celula" title={memberCell.name} />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-600">
                  {memberCell.meetingDay}, {memberCell.meetingTime}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">{nextMeetingDate}</p>
              </div>
              <span className={`rounded-lg px-3 py-2 text-xs font-bold ${rsvpTone(currentRsvp?.response)}`}>
                {rsvpLabel(currentRsvp?.response)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={() => respondRsvp("yes")} className="min-h-11 rounded-lg bg-emerald-900 text-sm font-bold text-white">
                Vou
              </button>
              <button onClick={() => respondRsvp("maybe")} className="min-h-11 rounded-lg bg-amber-100 text-sm font-bold text-amber-900">
                Talvez
              </button>
              <button onClick={() => respondRsvp("no")} className="min-h-11 rounded-lg bg-rose-100 text-sm font-bold text-rose-800">
                Nao vou
              </button>
            </div>
          </section>
        )}

        <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Minha agenda" title="Semana pessoal" />
          <div className="grid gap-3">
            {personalAgenda.map((item) => (
              <article key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                <p className="mt-2 text-xs font-bold text-slate-400">{item.support}</p>
              </article>
            ))}
            {personalAgenda.length === 0 && (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Sua agenda vai aparecer aqui conforme sua celula e seu discipulado forem vinculados.
              </p>
            )}
          </div>
        </section>

        {nextSteps.length > 0 && (
          <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Seus proximos passos" title="Caminho da semana" />
            <div className="grid gap-3">
              {nextSteps.map((item) => (
                <article key={item.title} className={`rounded-2xl p-4 ${item.tone}`}>
                  <p className="font-black">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 opacity-90">{item.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Cuidado" title="Como sua lideranca pode te ajudar?" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {careOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setCareType(option.value)}
                className={`min-h-11 rounded-lg px-3 text-sm font-bold ${
                  careType === option.value ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <textarea
            value={careText}
            onChange={(event) => setCareText(event.target.value)}
            rows={4}
            className="mt-3 min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            placeholder="Explique com clareza o que esta acontecendo para sua lideranca te acompanhar melhor."
          />
          <button
            type="button"
            onClick={requestCare}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white"
          >
            <Heart size={17} />
            Enviar pedido de cuidado
          </button>
        </section>

        <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Oracao" title="Meus pedidos recentes" />
          <div className="space-y-3">
            {memberRequests.map((request) => (
              <article key={request.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-950">{request.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{request.request}</p>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-xs font-bold ${prayerStatusTone(request.status)}`}>
                    {prayerStatusLabel(request.status)}
                  </span>
                </div>
              </article>
            ))}
            {memberRequests.length === 0 && (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Seus pedidos de oracao enviados aparecem aqui para voce acompanhar.
              </p>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Minha caminhada" title="Historico recente" />
          <div className="space-y-3">
            {journeyItems.map((item) => (
              <article key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                <p className="mt-2 text-xs font-bold text-slate-400">
                  {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}
                </p>
              </article>
            ))}
            {journeyItems.length === 0 && (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Sua jornada vai aparecer aqui conforme voce confirmar presenca, responder a trilha e registrar pedidos.
              </p>
            )}
          </div>
        </section>

        {activeTrack && nextVideo ? (
          <>
            <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
              <SectionHeader eyebrow={selectedVideo?.id === nextVideo.id ? "Proximo video" : "Aula selecionada"} title={selectedVideo?.title ?? nextVideo.title} />
              {selectedVideo && isEmbeddableVideo(selectedVideo.videoUrl) ? (
                <iframe
                  src={getVideoEmbedUrl(selectedVideo.videoUrl)}
                  title={selectedVideo.title}
                  className="aspect-video w-full rounded-lg border-0 bg-slate-950"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="aspect-video rounded-lg bg-[linear-gradient(135deg,#0f766e,#2563eb)] p-5 text-white">
                  <div className="flex h-full flex-col justify-between">
                    <PlayCircle size={42} className="animate-soft-pulse" />
                    <div>
                      <p className="text-sm font-semibold">{selectedVideo?.description ?? nextVideo.description}</p>
                      <p className="mt-2 text-xs font-bold text-emerald-100">{formatDuration(selectedVideo?.durationSeconds ?? nextVideo.durationSeconds)}</p>
                    </div>
                  </div>
                </div>
              )}
              {selectedVideo && (
                <>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
                      <span>Seu progresso</span>
                      <span>{selectedProgress}%</span>
                    </div>
                    <ProgressBar value={selectedProgress} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[25, 50, 75, 100].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => saveVideoProgress(selectedVideo.id, percent)}
                        className={`min-h-11 rounded-lg text-sm font-bold ${
                          percent === 100 ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {percent === 100 ? "Concluir" : `${percent}%`}
                      </button>
                    ))}
                  </div>
                  <a
                    href={selectedVideo.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
                  >
                    <ExternalLink size={17} />
                    Abrir video fora do app
                  </a>
                </>
              )}
            </section>

            <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
              <SectionHeader eyebrow="Reflexao" title="O que voce aprendeu?" />
              <textarea
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
                placeholder="Escreva uma resposta, duvida ou decisao para conversar com seu lider."
                className="min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                onClick={saveReflection}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white"
              >
                <Save size={17} />
                Salvar reflexao
              </button>
            </section>

            <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
              <SectionHeader eyebrow="Aulas" title={activeTrack.title} />
              <div className="space-y-3">
                {trackVideos.map((video, index) => {
                  const itemProgress = progressByVideo.get(video.id)?.progressPercent ?? 0;
                  const isLocked = index > 0 && (progressByVideo.get(trackVideos[index - 1]?.id)?.progressPercent ?? 0) < 100;

                  return (
                    <button
                      key={video.id}
                      onClick={() => {
                        if (!isLocked) {
                          setSelectedVideoId(video.id);
                        }
                      }}
                      className={`w-full rounded-lg p-4 text-left ${selectedVideo?.id === video.id ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50"}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-800">
                            {isLocked ? <Lock size={17} /> : itemProgress >= 100 ? <CheckCircle2 size={17} /> : <PlayCircle size={17} />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{video.title}</p>
                            <p className="text-xs font-semibold text-slate-400">{formatDuration(video.durationSeconds)}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-700">{itemProgress}%</span>
                      </div>
                      <ProgressBar value={itemProgress} />
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 text-center shadow-sm">
            <SectionHeader eyebrow="Aguardando liberacao" title="Nenhuma trilha ativa" />
            <p className="text-sm leading-6 text-slate-500">
              Seu lider ainda nao liberou uma trilha de discipulado para voce.
            </p>
          </section>
        )}

        {feedback && (
          <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            {feedback}
          </div>
        )}

        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
          <MessageCircle size={14} />
          Lider responsavel: {member.leader}. Se precisar de ajuda, use o pedido de cuidado acima.
        </div>

        <section id="perfil" className="rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Meu perfil" title="Atualizar meus dados" />
          <form onSubmit={saveMemberProfile} className="native-form space-y-3">
            <input name="photoUrl" defaultValue={member.photoUrl} className="field-control" placeholder="URL da foto de perfil" />
            <input name="name" defaultValue={member.name} className="field-control" placeholder="Nome completo" />
            <input name="phone" defaultValue={member.phone} inputMode="tel" className="field-control" placeholder="WhatsApp" />
            <input name="email" defaultValue={member.email} type="email" className="field-control" placeholder="Email" />
            <input name="birthDate" defaultValue={member.birthDate} type="date" className="field-control" aria-label="Data de nascimento" />
            <input name="address" defaultValue={member.address} className="field-control" placeholder="Endereco completo" />
            <input name="familyPhone" defaultValue={member.familyPhone} inputMode="tel" className="field-control" placeholder="Telefone de familiar" />
            <button className="primary-action">
              <Save size={17} />
              Salvar perfil
            </button>
          </form>
        </section>
      </section>
    </AppShell>
  );
}

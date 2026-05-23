"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Lock, MessageCircle, PlayCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { PersonAvatar } from "@/components/person-avatar";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { useActivityEvents, useDiscipleship, useLocalPeople } from "@/lib/local-store";

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export default function MemberDiscipleshipPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { tracks, videos, accesses, progress, updateVideoProgress } = useDiscipleship();
  const { addEvent } = useActivityEvents();
  const [feedback, setFeedback] = useState("");
  const member =
    people.find((person) => person.personUserId === currentUser.id || person.id === currentUser.personId) ??
    people[1];
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

  async function completeVideo(videoId: string) {
    const video = trackVideos.find((item) => item.id === videoId);
    if (!video) {
      return;
    }

    const result = await updateVideoProgress({
      personId: member.id,
      videoId,
      progressPercent: 100,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setFeedback(`Nao consegui salvar seu progresso: ${result.error}`);
      return;
    }

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

    setFeedback(`Aula concluida: ${video.title}.`);
  }

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-4 pb-8 pt-4 text-slate-900">
      <div className="mx-auto max-w-xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm"
            aria-label="Voltar"
          >
            <ArrowLeft size={19} />
          </Link>
          <p className="text-sm font-bold text-emerald-700">Meu discipulado</p>
          <PersonAvatar person={member} size="sm" />
        </header>

        <section className="rounded-lg bg-slate-950 p-5 text-white shadow-lg shadow-slate-900/10">
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

        {activeTrack && nextVideo ? (
          <>
            <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
              <SectionHeader eyebrow="Proximo video" title={nextVideo.title} />
              <div className="aspect-video rounded-lg bg-[linear-gradient(135deg,#0f766e,#2563eb)] p-5 text-white">
                <div className="flex h-full flex-col justify-between">
                  <PlayCircle size={42} className="animate-soft-pulse" />
                  <div>
                    <p className="text-sm font-semibold">{nextVideo.description}</p>
                    <p className="mt-2 text-xs font-bold text-emerald-100">{formatDuration(nextVideo.durationSeconds)}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => completeVideo(nextVideo.id)}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white"
              >
                <CheckCircle2 size={18} />
                Marcar aula como concluida
              </button>
            </section>

            <section className="mt-5 rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
              <SectionHeader eyebrow="Aulas" title={activeTrack.title} />
              <div className="space-y-3">
                {trackVideos.map((video, index) => {
                  const itemProgress = progressByVideo.get(video.id)?.progressPercent ?? 0;
                  const isLocked = index > 0 && (progressByVideo.get(trackVideos[index - 1]?.id)?.progressPercent ?? 0) < 100;

                  return (
                    <div key={video.id} className="rounded-lg bg-slate-50 p-4">
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
                    </div>
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

        <WhatsAppButton
          phone={member.phone}
          message={`Ola, ${member.leader}! Tenho uma pergunta sobre meu discipulado.`}
          label="Falar com lider"
          className="mt-5 w-full"
        />

        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
          <MessageCircle size={14} />
          Lider responsavel: {member.leader}
        </div>
      </div>
    </main>
  );
}

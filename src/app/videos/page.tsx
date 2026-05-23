"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { BookOpenCheck, Lock, Play, Plus, Send, Video } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { canManagePeople, getVisiblePeople } from "@/lib/access-control";
import { useActivityEvents, useDiscipleship, useLocalPeople } from "@/lib/local-store";

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export default function VideosPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { tracks, videos, accesses, progress, addTrack, addVideo, releaseTrack } = useDiscipleship();
  const { addEvent } = useActivityEvents();
  const visiblePeople = getVisiblePeople(currentUser, people);
  const churchTracks = tracks.filter((track) => track.churchId === currentUser.churchId || isDemoMode);
  const [selectedTrackId, setSelectedTrackId] = useState(churchTracks[0]?.id ?? "");
  const selectedTrack = churchTracks.find((track) => track.id === selectedTrackId) ?? churchTracks[0];
  const trackVideos = videos
    .filter((video) => video.trackId === selectedTrack?.id && video.active)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const [selectedPersonId, setSelectedPersonId] = useState(visiblePeople[0]?.id ?? "");
  const [feedback, setFeedback] = useState("");
  const [trackTitle, setTrackTitle] = useState("");
  const [trackDescription, setTrackDescription] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoMinutes, setVideoMinutes] = useState(10);
  const canCreateContent = currentUser.role === "admin" || currentUser.role === "pastor";
  const canRelease = canManagePeople(currentUser);

  const selectedPerson = visiblePeople.find((person) => person.id === selectedPersonId) ?? visiblePeople[0];
  const releasedCount = selectedTrack ? accesses.filter((access) => access.trackId === selectedTrack.id).length : 0;
  const completedCount = useMemo(
    () =>
      trackVideos.reduce(
        (total, video) =>
          total + progress.filter((item) => item.videoId === video.id && item.progressPercent >= 100).length,
        0,
      ),
    [progress, trackVideos],
  );
  const trackAverage = trackVideos.length && releasedCount ? Math.round(completedCount / (trackVideos.length * releasedCount) * 100) : 0;

  async function handleRelease() {
    if (!selectedTrack || !selectedPerson) {
      setFeedback("Escolha uma pessoa e uma trilha antes de liberar.");
      return;
    }

    const result = await releaseTrack({
      personId: selectedPerson.id,
      trackId: selectedTrack.id,
      releasedBy: currentUser.id,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setFeedback(`Nao consegui liberar a trilha: ${result.error}`);
      return;
    }

    await addEvent({
      churchId: currentUser.churchId,
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "Liberou discipulado",
      description: `${currentUser.name} liberou ${selectedTrack.title} para ${selectedPerson.name}.`,
      targetType: "video",
      targetId: selectedTrack.id,
      targetName: selectedTrack.title,
      personId: selectedPerson.id,
      cellId: selectedPerson.cellId,
      visibility: "leadership",
      persistToSupabase: !isDemoMode,
    });

    setFeedback(`${selectedTrack.title} liberada para ${selectedPerson.name}.`);
  }

  async function handleCreateTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trackTitle.trim()) {
      setFeedback("Informe o nome da trilha.");
      return;
    }

    const result = await addTrack({
      churchId: currentUser.churchId,
      title: trackTitle,
      description: trackDescription,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok || !result.track) {
      setFeedback(`Nao consegui criar a trilha: ${result.error}`);
      return;
    }

    setSelectedTrackId(result.track.id);
    setTrackTitle("");
    setTrackDescription("");
    setFeedback(`Trilha ${result.track.title} criada.`);
  }

  async function handleCreateVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTrack || !videoTitle.trim() || !videoUrl.trim()) {
      setFeedback("Escolha a trilha e informe titulo e URL do video.");
      return;
    }

    const result = await addVideo({
      trackId: selectedTrack.id,
      title: videoTitle,
      description: videoDescription,
      videoUrl,
      durationSeconds: videoMinutes * 60,
      orderIndex: trackVideos.length + 1,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      setFeedback(`Nao consegui cadastrar o video: ${result.error}`);
      return;
    }

    setVideoTitle("");
    setVideoDescription("");
    setVideoUrl("");
    setVideoMinutes(10);
    setFeedback("Video cadastrado na trilha.");
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader
            eyebrow="Discipulado"
            title="Trilhas e videos"
            action={
              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                {churchTracks.length} trilhas
              </span>
            }
          />
          <div className="grid gap-3 md:grid-cols-3">
            {churchTracks.map((track) => (
              <button
                key={track.id}
                onClick={() => setSelectedTrackId(track.id)}
                className={`rounded-lg p-4 text-left transition ${
                  selectedTrack?.id === track.id ? "bg-emerald-900 text-white shadow-lg shadow-emerald-900/15" : "bg-slate-50 text-slate-700 hover:bg-white"
                }`}
              >
                <BookOpenCheck size={22} />
                <p className="mt-3 font-bold">{track.title}</p>
                <p className={`mt-1 line-clamp-2 text-sm ${selectedTrack?.id === track.id ? "text-emerald-100" : "text-slate-500"}`}>
                  {track.description || "Trilha de discipulado"}
                </p>
              </button>
            ))}
          </div>
        </div>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-5">
            <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
              <SectionHeader eyebrow="Trilha selecionada" title={selectedTrack?.title ?? "Nenhuma trilha"} />
              <div className="aspect-video rounded-lg bg-[linear-gradient(135deg,#064e3b,#0f766e,#2563eb)] p-5 text-white shadow-lg shadow-emerald-900/15">
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <span className="rounded-lg bg-white/15 px-3 py-1 text-xs font-bold">Progresso geral</span>
                    <h3 className="mt-4 max-w-sm text-2xl font-semibold">{selectedTrack?.description || "Organize a caminhada de novos membros."}</h3>
                  </div>
                  {canRelease && (
                    <button onClick={handleRelease} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-emerald-950 hover:bg-emerald-50">
                      <Send size={16} />
                      Liberar para pessoa
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <ProgressBar value={trackAverage} />
              </div>

              {canRelease && (
                <div className="mt-5 rounded-lg bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-950">Liberacao rapida</p>
                  <select
                    value={selectedPerson?.id ?? ""}
                    onChange={(event) => setSelectedPersonId(event.target.value)}
                    className="mt-3 min-h-11 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm font-medium text-slate-700"
                  >
                    {visiblePeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} - {person.cell}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {feedback && (
                <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
                  {feedback}
                </div>
              )}
            </div>

            {canCreateContent && (
              <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
                <SectionHeader eyebrow="Conteudo" title="Cadastrar trilha" />
                <form onSubmit={handleCreateTrack} className="space-y-3">
                  <input value={trackTitle} onChange={(event) => setTrackTitle(event.target.value)} placeholder="Nome da trilha" className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  <textarea value={trackDescription} onChange={(event) => setTrackDescription(event.target.value)} placeholder="Descricao curta" rows={3} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white">
                    <Plus size={18} />
                    Criar trilha
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
              <SectionHeader eyebrow="Aulas" title="Videos cadastrados" />
              <div className="space-y-3">
                {trackVideos.map((video, index) => (
                  <article key={video.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-800">
                          {video.active ? <Play size={18} /> : <Lock size={18} />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-950">
                            {index + 1}. {video.title}
                          </p>
                          <p className="mt-1 text-sm leading-5 text-slate-500">{video.description}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-600">
                        {formatDuration(video.durationSeconds)}
                      </span>
                    </div>
                  </article>
                ))}
                {trackVideos.length === 0 && (
                  <div className="rounded-lg bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                    Cadastre o primeiro video desta trilha.
                  </div>
                )}
              </div>
            </div>

            {canCreateContent && selectedTrack && (
              <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
                <SectionHeader eyebrow="Nova aula" title={`Adicionar em ${selectedTrack.title}`} />
                <form onSubmit={handleCreateVideo} className="space-y-3">
                  <input value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} placeholder="Titulo do video" className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  <input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="URL do video" className="min-h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  <div className="grid grid-cols-[1fr_120px] gap-3">
                    <input value={videoDescription} onChange={(event) => setVideoDescription(event.target.value)} placeholder="Descricao" className="min-h-12 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                    <input type="number" min="1" value={videoMinutes} onChange={(event) => setVideoMinutes(Number(event.target.value))} className="min-h-12 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white">
                    <Video size={18} />
                    Cadastrar video
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>
      </section>
    </AppShell>
  );
}

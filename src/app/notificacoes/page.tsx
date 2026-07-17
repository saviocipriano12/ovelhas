"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  Bell,
  BellRing,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  Church,
  ClipboardList,
  HeartHandshake,
  Heart,
  Image as ImageIcon,
  PlayCircle,
  Send,
  ShieldAlert,
  Upload,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { getScopedCells } from "@/lib/access-control";
import { isImageMedia, isVideoMedia, parseNoticeDescription } from "@/lib/church-notices";
import type { UserRole } from "@/lib/data";
import { notificationsEnabled, requestDeviceNotificationPermission } from "@/lib/device-notifications";
import { useActivityEvents, useCells } from "@/lib/local-store";
import type { PastoralNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase/client";
import { usePastoralNotifications } from "@/lib/use-pastoral-notifications";

const typeIcons: Record<PastoralNotification["type"], LucideIcon> = {
  care: HeartHandshake,
  absence: UserRound,
  birthday: CalendarDays,
  video: PlayCircle,
  report: ClipboardList,
  supervision: Church,
  agenda: Bell,
  structure: ShieldAlert,
  prayer: Heart,
  notice: BellRing,
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Nao consegui ler a midia."));
    reader.readAsDataURL(file);
  });
}

function priorityTone(priority: PastoralNotification["priority"]) {
  if (priority === "Urgente") {
    return "bg-rose-100 text-rose-800";
  }

  if (priority === "Alta") {
    return "bg-amber-100 text-amber-900";
  }

  if (priority === "Media") {
    return "bg-sky-100 text-sky-800";
  }

  return "bg-emerald-100 text-emerald-800";
}

const AUDIENCE_OPTIONS: { role: string; label: string }[] = [
  { role: "member", label: "Membros" },
  { role: "leader", label: "Lideres" },
  { role: "supervisor", label: "Supervisores" },
  { role: "consolidation", label: "Consolidacao" },
  { role: "communication", label: "Comunicacao" },
];

function typeLabel(type: PastoralNotification["type"]) {
  const labels: Record<PastoralNotification["type"], string> = {
    care: "Cuidado",
    absence: "Ausencia",
    birthday: "Aniversario",
    video: "Video",
    report: "Relatorio",
    supervision: "Supervisao",
    agenda: "Agenda",
    structure: "Gestao",
    prayer: "Oracao",
    notice: "Aviso",
  };
  return labels[type];
}

export default function NotificationsPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { cells } = useCells();
  const { addEvent } = useActivityEvents();
  const { notifications, unread, readSet, markRead, markUnread, markAllRead } = usePastoralNotifications();
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "unread" | PastoralNotification["priority"]>("unread");
  const [deviceEnabled, setDeviceEnabled] = useState(() => notificationsEnabled());
  const [targetMode, setTargetMode] = useState<"church" | "cell">("church");
  const [mediaUrl, setMediaUrl] = useState("");
  const [noticeAudiences, setNoticeAudiences] = useState<string[]>(["member"]);
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const canSendToChurch = ["admin", "pastor", "communication"].includes(currentUser.role);
  const canSendNotice =
    ["admin", "pastor", "supervisor", "leader", "communication"].includes(currentUser.role) &&
    (visibleCells.length > 0 || canSendToChurch);

  async function enableDeviceNotifications() {
    const result = await requestDeviceNotificationPermission();
    setDeviceEnabled(result.ok);

    if (result.ok) {
      toast.success("Avisos ativados. Eles aparecem enquanto o Ovelhas estiver aberto no aparelho.");
    } else {
      toast.error("Nao consegui ativar os avisos neste aparelho.");
    }
  }

  async function handleMediaUpload(file?: File | null) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Envie uma imagem ou video curto.");
      return;
    }

    if (isDemoMode) {
      if (file.size > 1400 * 1024) {
        toast.error("Use uma midia menor que 1.4 MB para abrir bem no celular.");
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        setMediaUrl(dataUrl);
        toast.success("Midia carregada. Agora envie o comunicado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Nao consegui carregar a midia.");
      }
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Use uma midia menor que 15 MB.");
      return;
    }

    const extension = file.name.split(".").pop() || (file.type.startsWith("video/") ? "mp4" : "jpg");
    const path = `${currentUser.churchId}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("notice-media").upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error(`Nao consegui enviar a midia: ${uploadError.message}`);
      return;
    }

    const { data } = supabase.storage.from("notice-media").getPublicUrl(path);
    setMediaUrl(data.publicUrl);
    toast.success("Midia carregada. Agora envie o comunicado.");
  }

  async function sendCellNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const cellId = String(formData.get("cellId") || visibleCells[0]?.id || "");
    const title = String(formData.get("title") || "Aviso da igreja").trim();
    const noticeType = String(formData.get("noticeType") || "Aviso").trim();
    const message = String(formData.get("message") || "").trim();
    const typedMediaUrl = String(formData.get("mediaUrl") || "").trim();
    const cell = visibleCells.find((item) => item.id === cellId);
    const finalMediaUrl = mediaUrl || typedMediaUrl;
    const isChurchNotice = targetMode === "church" && canSendToChurch;

    if (!isChurchNotice && !cell) {
      toast.error("Escolha a celula para enviar este aviso.");
      return;
    }

    if (!message) {
      toast.error("Escreva a mensagem do aviso.");
      return;
    }

    if (isChurchNotice && noticeAudiences.length === 0) {
      toast.error("Escolha pelo menos um publico para o comunicado.");
      return;
    }

    await addEvent({
      churchId: currentUser.churchId,
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: `${noticeType}: ${title}`,
      description: finalMediaUrl ? `${message}\n\nMidia: ${finalMediaUrl}` : message,
      targetType: "cell",
      targetId: isChurchNotice ? undefined : cell?.id,
      targetName: isChurchNotice ? "Toda a igreja" : cell?.name,
      cellId: isChurchNotice ? undefined : cell?.id,
      visibility: "member",
      targetRoles: isChurchNotice ? (noticeAudiences as UserRole[]) : undefined,
      persistToSupabase: !isDemoMode,
    });

    event.currentTarget.reset();
    setNoticeAudiences(["member"]);
    setMediaUrl("");
    toast.success(isChurchNotice ? "Comunicado enviado para toda a igreja." : `Aviso enviado para ${cell?.name}.`);
  }

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "all") {
      return true;
    }

    if (filter === "unread") {
      return !readSet.has(notification.id);
    }

    return notification.priority === filter;
  });

  const urgentCount = notifications.filter((notification) => notification.priority === "Urgente").length;

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader
          eyebrow="Central inteligente"
          title="Notificacoes"
          action={
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={enableDeviceNotifications}
                title="Os avisos aparecem enquanto o Ovelhas estiver aberto no aparelho, nao em segundo plano."
                className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold ${
                  deviceEnabled ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-950"
                }`}
              >
                <BellRing size={16} />
                {deviceEnabled ? "Aparelho ativo" : "Ativar aparelho"}
              </button>
              <button
                onClick={() => markAllRead(notifications.map((notification) => notification.id))}
                className="flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-bold text-white"
              >
                <CheckCheck size={16} />
                Ler tudo
              </button>
            </div>
          }
        />

        {!deviceEnabled && (
          <p className="rounded-lg bg-slate-100 p-3 text-xs font-semibold leading-5 text-slate-500">
            Os avisos do aparelho aparecem enquanto o Ovelhas estiver aberto. Com o app fechado, confira as notificacoes
            aqui na central.
          </p>
        )}

        {canSendNotice && (
          <form onSubmit={sendCellNotice} className="native-form rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                <Send size={19} />
              </span>
              <div>
                <p className="text-xs font-black uppercase text-emerald-700">Aviso para membros</p>
                <h2 className="text-lg font-black text-slate-950">Enviar comunicado</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {canSendToChurch && (
                <select
                  value={targetMode}
                  onChange={(event) => setTargetMode(event.target.value as "church" | "cell")}
                  className="field-control"
                >
                  <option value="church">Toda a igreja</option>
                  <option value="cell">Celula especifica</option>
                </select>
              )}
              {(!canSendToChurch || targetMode === "cell") && (
                <select name="cellId" className="field-control">
                  {visibleCells.map((cell) => (
                    <option key={cell.id} value={cell.id}>
                      {cell.name}
                    </option>
                  ))}
                </select>
              )}
              {canSendToChurch && targetMode === "church" && (
                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-xs font-black uppercase text-slate-400">Enviar para</p>
                  <div className="flex flex-wrap gap-2">
                    {AUDIENCE_OPTIONS.map((option) => {
                      const checked = noticeAudiences.includes(option.role);
                      return (
                        <button
                          key={option.role}
                          type="button"
                          onClick={() =>
                            setNoticeAudiences((current) =>
                              checked ? current.filter((role) => role !== option.role) : [...current, option.role],
                            )
                          }
                          className={`flex min-h-10 items-center gap-1.5 rounded-2xl px-3 text-xs font-black transition ${
                            checked ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {checked && <CheckCircle2 size={14} />}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <select name="noticeType" className="field-control">
                <option>Aviso</option>
                <option>Noticia do mes</option>
                <option>Evento</option>
                <option>Convite de culto</option>
                <option>Flyer</option>
                <option>Video</option>
              </select>
              <input name="title" className="field-control" placeholder="Titulo do aviso" defaultValue="Aviso da igreja" />
              <input name="mediaUrl" className="field-control sm:col-span-2" placeholder="Link de imagem ou video opcional" />
              <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-900 sm:col-span-2">
                <Upload size={18} />
                Upload rapido de imagem/video curto
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(event) => handleMediaUpload(event.target.files?.[0])}
                />
              </label>
              {mediaUrl ? (
                <div className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600 sm:col-span-2">
                  <ImageIcon className="mr-2 inline text-emerald-700" size={15} />
                  Midia carregada para este comunicado.
                </div>
              ) : null}
              <textarea
                name="message"
                required
                rows={3}
                className="field-control min-h-28 resize-none py-3 sm:col-span-2"
                placeholder="Ex: Nesta semana a celula sera em outro endereco..."
              />
            </div>
            <button className="primary-action mt-3">
              <Send size={17} />
              Enviar aviso
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <Bell size={20} className="text-emerald-200" />
            <p className="mt-3 text-2xl font-semibold">{notifications.length}</p>
            <p className="text-sm text-slate-300">Total</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <ShieldAlert size={20} className="text-rose-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{urgentCount}</p>
            <p className="text-sm text-slate-500">Urgentes</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <CheckCircle2 size={20} className="text-amber-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{unread.length}</p>
            <p className="text-sm text-slate-500">Nao lidas</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
          {[
            { id: "unread", label: "Nao lidas" },
            { id: "all", label: "Todas" },
            { id: "Urgente", label: "Urgentes" },
            { id: "Alta", label: "Alta" },
            { id: "Media", label: "Media" },
            { id: "Baixa", label: "Baixa" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as typeof filter)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold shadow-sm ${
                filter === item.id ? "bg-emerald-900 text-white" : "border border-white/80 bg-white/90 text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const Icon = typeIcons[notification.type];
              const read = readSet.has(notification.id);
              const { message, mediaUrl } =
                notification.type === "notice"
                  ? parseNoticeDescription(notification.description)
                  : { message: notification.description, mediaUrl: "" };

              return (
                <article key={notification.id} className={`rounded-lg p-4 ${read ? "bg-slate-50 opacity-75" : "bg-white ring-1 ring-emerald-100"}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-lg px-2 py-1 text-xs font-bold ${priorityTone(notification.priority)}`}>
                          {notification.priority}
                        </span>
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                          {typeLabel(notification.type)}
                        </span>
                        {!read && <span className="h-2 w-2 rounded-full bg-amber-400" />}
                      </div>
                      <h3 className="mt-3 text-base font-bold leading-tight text-slate-950">{notification.title}</h3>
                      <p className="mt-1 text-sm leading-5 text-slate-500">{message}</p>
                      {mediaUrl && isImageMedia(mediaUrl) && (
                        <div
                          aria-label="Midia do aviso"
                          className="mt-3 aspect-[16/9] w-full rounded-lg bg-cover bg-center"
                          style={{ backgroundImage: `url("${mediaUrl}")` }}
                        />
                      )}
                      {mediaUrl && isVideoMedia(mediaUrl) && (
                        <video src={mediaUrl} controls className="mt-3 aspect-video w-full rounded-lg bg-slate-950" />
                      )}
                      {mediaUrl && !isImageMedia(mediaUrl) && !isVideoMedia(mediaUrl) && (
                        <a
                          href={mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700"
                        >
                          Abrir midia
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                    <Link
                      href={notification.href}
                      onClick={() => markRead(notification.id)}
                      className="flex min-h-11 items-center justify-center rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white"
                    >
                      Abrir
                    </Link>
                    <button
                      onClick={() => (read ? markUnread(notification.id) : markRead(notification.id))}
                      className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-600"
                      aria-label={read ? "Marcar como nao lida" : "Marcar como lida"}
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  </div>
                </article>
              );
            })}

            {filteredNotifications.length === 0 && (
              <div className="rounded-lg bg-slate-50 p-5 text-center">
                <Bell className="mx-auto text-slate-300" size={28} />
                <p className="mt-3 text-sm font-semibold text-slate-500">Nada pendente neste filtro.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </AppShell>
  );
}

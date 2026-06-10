import { BellRing, ExternalLink, Image as ImageIcon, PlayCircle } from "lucide-react";
import type { ActivityEvent } from "@/lib/data";
import { getNoticeTitle, isImageMedia, isVideoMedia, parseNoticeDescription } from "@/lib/church-notices";

export function ChurchNoticeCard({ event, compact = false }: { event: ActivityEvent; compact?: boolean }) {
  const { message, mediaUrl } = parseNoticeDescription(event.description);
  const title = getNoticeTitle(event);

  return (
    <article className="overflow-hidden rounded-[24px] border border-white/80 bg-white/95 shadow-sm">
      {mediaUrl && isImageMedia(mediaUrl) ? (
        <div
          aria-label={title}
          className="aspect-[16/9] w-full bg-cover bg-center"
          style={{ backgroundImage: `url("${mediaUrl}")` }}
        />
      ) : mediaUrl && isVideoMedia(mediaUrl) ? (
        <video src={mediaUrl} controls className="aspect-video w-full bg-slate-950" />
      ) : null}
      <div className={compact ? "p-4" : "p-5"}>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
            {mediaUrl ? <ImageIcon size={17} /> : <BellRing size={17} />}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase text-emerald-700">{event.targetName ?? "Comunicado"}</p>
            <h3 className="truncate text-base font-black text-slate-950">{title}</h3>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        {mediaUrl && !isImageMedia(mediaUrl) && !isVideoMedia(mediaUrl) ? (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white"
          >
            <ExternalLink size={17} />
            Abrir midia
          </a>
        ) : null}
        {!mediaUrl && !compact ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">
            <PlayCircle size={15} className="text-emerald-700" />
            Publicado por {event.actorName}
          </div>
        ) : null}
      </div>
    </article>
  );
}

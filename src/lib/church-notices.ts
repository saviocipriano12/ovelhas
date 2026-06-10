import type { ActivityEvent } from "@/lib/data";

const noticePrefixes = ["Aviso:", "Noticia do mes:", "Evento:", "Convite de culto:", "Flyer:", "Video:"];

export function isChurchNotice(event: ActivityEvent) {
  return event.visibility === "member" && noticePrefixes.some((prefix) => event.action.startsWith(prefix));
}

export function getNoticeTitle(event: ActivityEvent) {
  const prefix = noticePrefixes.find((item) => event.action.startsWith(item));
  return prefix ? event.action.replace(prefix, "").trim() || prefix.replace(":", "") : event.action;
}

export function parseNoticeDescription(description: string) {
  const marker = "\n\nMidia: ";
  const markerIndex = description.indexOf(marker);

  if (markerIndex === -1) {
    return { message: description, mediaUrl: "" };
  }

  return {
    message: description.slice(0, markerIndex),
    mediaUrl: description.slice(markerIndex + marker.length).trim(),
  };
}

export function isVideoMedia(url: string) {
  return url.startsWith("data:video") || /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
}

export function isImageMedia(url: string) {
  return url.startsWith("data:image") || /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(url);
}

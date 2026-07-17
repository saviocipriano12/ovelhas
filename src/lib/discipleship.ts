import type { DiscipleshipVideo, PersonTrackAccess, VideoProgressRecord } from "@/lib/data";

export function computeDiscipleshipProgress(
  personId: string,
  accesses: PersonTrackAccess[],
  videos: DiscipleshipVideo[],
  progress: VideoProgressRecord[],
): number | null {
  const personAccesses = accesses.filter((access) => access.personId === personId);
  if (personAccesses.length === 0) {
    return null;
  }

  const trackIds = new Set(personAccesses.map((access) => access.trackId));
  const trackVideos = videos.filter((video) => trackIds.has(video.trackId) && video.active);
  if (trackVideos.length === 0) {
    return null;
  }

  const completedVideoIds = new Set(
    progress.filter((item) => item.personId === personId && item.status === "completed").map((item) => item.videoId),
  );
  const completedCount = trackVideos.filter((video) => completedVideoIds.has(video.id)).length;

  return Math.round((completedCount / trackVideos.length) * 100);
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ActivityEvent, PastoralReminder, PrayerRequest, SupervisorVisit, UserRole } from "@/lib/data";

const OFFLINE_QUEUE_KEY = "ovelhas:offline-queue";
const OFFLINE_SYNC_EVENT = "ovelhas:offline-sync-success";

type CellAttendancePayload = {
  churchId: string;
  cellId: string;
  meetingDate: string;
  createdBy: string;
  visitorsCount: number;
  notes?: string;
  records: { personId: string; present: boolean; notes?: string }[];
};

type ServiceAttendancePayload = {
  churchId: string;
  serviceDate: string;
  title: string;
  createdBy: string;
  records: { personId: string; present: boolean }[];
};

type CellReportPayload = {
  localId: string;
  churchId?: string;
  cellId: string;
  leaderUserId: string;
  supervisorUserId: string;
  meetingDate: string;
  presentCount: number;
  visitorsCount: number;
  serviceCount: number;
  decisionsCount: number;
  highlights: string;
  needs: string;
  prayerRequests: string;
  supervisorVisited?: boolean;
  supervisorVisitNotes?: string;
};

type SupervisorVisitPayload = {
  localId: string;
  churchId: string;
  cellId: string;
  supervisorUserId: string;
  leaderUserId: string;
  visitDate: string;
  visitType: SupervisorVisit["visitType"];
  leaderPresent: boolean;
  healthScore: number;
  notes: string;
  nextSteps: string;
};

type ActivityEventPayload = {
  localId: string;
  churchId: string;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  description: string;
  targetType: ActivityEvent["targetType"];
  targetId?: string;
  targetName?: string;
  cellId?: string;
  personId?: string;
  visibility: ActivityEvent["visibility"];
};

type PastoralReminderPayload = {
  localId: string;
  churchId: string;
  assignedTo: string;
  title: string;
  description: string;
  reminderType: PastoralReminder["reminderType"];
  dueAt: string;
  personId?: string;
  cellId?: string;
  createdBy: string;
};

type PrayerRequestPayload = {
  localId: string;
  churchId: string;
  personId: string;
  cellId?: string;
  title: string;
  request: string;
  visibility: PrayerRequest["visibility"];
  createdBy: string;
  createdByName: string;
};

type OfflineQueueItem =
  | {
      id: string;
      type: "cell-attendance";
      payload: CellAttendancePayload;
      createdAt: string;
    }
  | {
      id: string;
      type: "service-attendance";
      payload: ServiceAttendancePayload;
      createdAt: string;
    }
  | {
      id: string;
      type: "cell-report";
      payload: CellReportPayload;
      createdAt: string;
    }
  | {
      id: string;
      type: "supervisor-visit";
      payload: SupervisorVisitPayload;
      createdAt: string;
    }
  | {
      id: string;
      type: "activity-event";
      payload: ActivityEventPayload;
      createdAt: string;
    }
  | {
      id: string;
      type: "pastoral-reminder";
      payload: PastoralReminderPayload;
      createdAt: string;
    }
  | {
      id: string;
      type: "prayer-request";
      payload: PrayerRequestPayload;
      createdAt: string;
    };

export type OfflineSyncSuccessDetail = {
  type: OfflineQueueItem["type"];
  localId?: string;
  syncedId?: string;
  createdAt?: string;
};

function readQueue(): OfflineQueueItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]") as OfflineQueueItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueueItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("ovelhas:offline-queue"));
}

function emitSyncSuccess(detail: OfflineSyncSuccessDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<OfflineSyncSuccessDetail>(OFFLINE_SYNC_EVENT, { detail }));
}

export function enqueueOfflineAction(item: Omit<OfflineQueueItem, "id" | "createdAt">) {
  const nextItem: OfflineQueueItem = {
    ...item,
    id: `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  } as OfflineQueueItem;

  writeQueue([nextItem, ...readQueue()]);
  return nextItem;
}

async function sendCellAttendance(payload: CellAttendancePayload) {
  const { data: meeting, error: meetingError } = await supabase
    .from("cell_meetings")
    .insert({
      cell_id: payload.cellId,
      meeting_date: payload.meetingDate,
      visitors_count: payload.visitorsCount,
      notes: payload.notes || null,
      created_by: payload.createdBy,
    })
    .select("id")
    .single();

  if (meetingError || !meeting) {
    throw new Error(meetingError?.message ?? "Nao foi possivel criar a reuniao.");
  }

  const { error } = await supabase.from("cell_attendance").insert(
    payload.records.map((record) => ({
      meeting_id: meeting.id,
      person_id: record.personId,
      present: record.present,
      notes: record.notes || null,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }

  return { syncedId: meeting.id as string };
}

async function sendServiceAttendance(payload: ServiceAttendancePayload) {
  const { data: service, error: serviceError } = await supabase
    .from("church_services")
    .insert({
      church_id: payload.churchId,
      service_date: payload.serviceDate,
      title: payload.title,
      created_by: payload.createdBy,
    })
    .select("id")
    .single();

  if (serviceError || !service) {
    throw new Error(serviceError?.message ?? "Nao foi possivel criar o culto.");
  }

  const { error } = await supabase.from("service_attendance").insert(
    payload.records.map((record) => ({
      service_id: service.id,
      person_id: record.personId,
      present: record.present,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }

  return { syncedId: service.id as string };
}

async function sendCellReport(payload: CellReportPayload) {
  const reportPayload = {
    church_id: payload.churchId,
    cell_id: payload.cellId,
    leader_id: payload.leaderUserId || null,
    supervisor_id: payload.supervisorUserId || null,
    meeting_date: payload.meetingDate,
    present_count: payload.presentCount,
    visitors_count: payload.visitorsCount,
    service_count: payload.serviceCount,
    decisions_count: payload.decisionsCount,
    highlights: payload.highlights || null,
    needs: payload.needs || null,
    prayer_requests: payload.prayerRequests || null,
    supervisor_visited: payload.supervisorVisited ?? false,
    supervisor_visit_notes: payload.supervisorVisitNotes || null,
  };
  const legacyReportPayload = { ...reportPayload };
  delete (legacyReportPayload as Partial<typeof reportPayload>).supervisor_visited;
  delete (legacyReportPayload as Partial<typeof reportPayload>).supervisor_visit_notes;

  let { data, error } = await supabase
    .from("cell_reports")
    .insert(reportPayload)
    .select("id, created_at")
    .single();

  if (error && (error.message.includes("supervisor_visited") || error.message.includes("supervisor_visit_notes"))) {
    const fallback = await supabase
      .from("cell_reports")
      .insert(legacyReportPayload)
      .select("id, created_at")
      .single();

    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    throw new Error(error?.message ?? "Nao foi possivel sincronizar o relatorio agora.");
  }

  return { localId: payload.localId, syncedId: data.id as string, createdAt: data.created_at as string };
}

async function sendSupervisorVisit(payload: SupervisorVisitPayload) {
  const { data, error } = await supabase
    .from("supervisor_visits")
    .insert({
      church_id: payload.churchId,
      cell_id: payload.cellId,
      supervisor_id: payload.supervisorUserId,
      leader_id: payload.leaderUserId || null,
      visit_date: payload.visitDate,
      visit_type: payload.visitType,
      leader_present: payload.leaderPresent,
      health_score: payload.healthScore,
      notes: payload.notes || null,
      next_steps: payload.nextSteps || null,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nao foi possivel sincronizar a supervisao agora.");
  }

  return { localId: payload.localId, syncedId: data.id as string, createdAt: data.created_at as string };
}

async function sendActivityEvent(payload: ActivityEventPayload) {
  const { data, error } = await supabase
    .from("activity_events")
    .insert({
      church_id: payload.churchId,
      actor_user_id: payload.actorUserId,
      actor_name: payload.actorName,
      actor_role: payload.actorRole,
      action: payload.action,
      description: payload.description,
      target_type: payload.targetType,
      target_id: payload.targetId || null,
      target_name: payload.targetName || null,
      cell_id: payload.cellId || null,
      person_id: payload.personId || null,
      visibility: payload.visibility,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nao foi possivel sincronizar a atividade agora.");
  }

  return { localId: payload.localId, syncedId: data.id as string, createdAt: data.created_at as string };
}

async function sendPastoralReminder(payload: PastoralReminderPayload) {
  const { data, error } = await supabase
    .from("pastoral_reminders")
    .insert({
      church_id: payload.churchId,
      assigned_to: payload.assignedTo,
      title: payload.title,
      description: payload.description || null,
      reminder_type: payload.reminderType,
      due_at: payload.dueAt,
      person_id: payload.personId || null,
      cell_id: payload.cellId || null,
      created_by: payload.createdBy,
      status: "open",
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nao foi possivel sincronizar o lembrete agora.");
  }

  return { localId: payload.localId, syncedId: data.id as string, createdAt: data.created_at as string };
}

async function sendPrayerRequest(payload: PrayerRequestPayload) {
  const { data, error } = await supabase
    .from("prayer_requests")
    .insert({
      church_id: payload.churchId,
      person_id: payload.personId,
      cell_id: payload.cellId || null,
      title: payload.title,
      request: payload.request,
      visibility: payload.visibility,
      status: "open",
      created_by: payload.createdBy,
      created_by_name: payload.createdByName,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nao foi possivel sincronizar o pedido agora.");
  }

  return { localId: payload.localId, syncedId: data.id as string, createdAt: data.created_at as string };
}

export async function processOfflineQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, processed: 0 };
  }

  const queue = readQueue().reverse();
  const remaining: OfflineQueueItem[] = [];
  let processed = 0;

  for (const item of queue) {
    try {
      const result =
        item.type === "cell-attendance"
          ? await sendCellAttendance(item.payload)
          : item.type === "service-attendance"
            ? await sendServiceAttendance(item.payload)
            : item.type === "cell-report"
              ? await sendCellReport(item.payload)
              : item.type === "supervisor-visit"
                ? await sendSupervisorVisit(item.payload)
                : item.type === "activity-event"
                  ? await sendActivityEvent(item.payload)
                  : item.type === "pastoral-reminder"
                    ? await sendPastoralReminder(item.payload)
                    : await sendPrayerRequest(item.payload);

      emitSyncSuccess({
        type: item.type,
        localId: "localId" in item.payload ? item.payload.localId : undefined,
        syncedId: result.syncedId,
        createdAt: typeof (result as { createdAt?: string }).createdAt === "string" ? (result as { createdAt?: string }).createdAt : undefined,
      });
      processed += 1;
    } catch {
      remaining.push(item);
    }
  }

  writeQueue(remaining.reverse());
  return { ok: remaining.length === 0, processed };
}

export function useOfflineQueue() {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshQueue = useCallback(() => {
    setPendingCount(readQueue().length);
  }, []);

  useEffect(() => {
    queueMicrotask(refreshQueue);

    window.addEventListener("storage", refreshQueue);
    window.addEventListener("ovelhas:offline-queue", refreshQueue);

    return () => {
      window.removeEventListener("storage", refreshQueue);
      window.removeEventListener("ovelhas:offline-queue", refreshQueue);
    };
  }, [refreshQueue]);

  return { pendingCount, refreshQueue };
}

export function useOfflineSyncSuccess(
  handler: (detail: OfflineSyncSuccessDetail) => void,
) {
  useEffect(() => {
    function listener(event: Event) {
      const detail = (event as CustomEvent<OfflineSyncSuccessDetail>).detail;
      if (detail) {
        handler(detail);
      }
    }

    window.addEventListener(OFFLINE_SYNC_EVENT, listener);
    return () => {
      window.removeEventListener(OFFLINE_SYNC_EVENT, listener);
    };
  }, [handler]);
}

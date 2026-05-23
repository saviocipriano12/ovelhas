"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const OFFLINE_QUEUE_KEY = "ovelhas:offline-queue";

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
      if (item.type === "cell-attendance") {
        await sendCellAttendance(item.payload);
      } else {
        await sendServiceAttendance(item.payload);
      }
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

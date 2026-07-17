"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  getScopedActivityEvents,
  getScopedCareTasks,
  getScopedCells,
  getScopedPastoralReminders,
  getScopedPeople,
  getScopedPrayerRequests,
  getScopedSupervisorVisits,
} from "@/lib/access-control";
import {
  useActivityEvents,
  useCareTasks,
  useCellReports,
  useCells,
  useDiscipleship,
  useLocalPeople,
  useNotificationReads,
  usePastoralReminders,
  usePrayerRequests,
  useSupervisorVisits,
} from "@/lib/local-store";
import { getPastoralNotifications } from "@/lib/notifications";

export function usePastoralNotifications() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { tasks } = useCareTasks();
  const { reports } = useCellReports();
  const { visits } = useSupervisorVisits();
  const { reminders } = usePastoralReminders();
  const { requests } = usePrayerRequests();
  const { events } = useActivityEvents();
  const { accesses, progress, tracks: discipleshipTracks } = useDiscipleship();
  const reads = useNotificationReads(currentUser.id);

  const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);
  const visibleCells = getScopedCells(currentUser, cells, isDemoMode);
  const visibleCellIds = new Set(visibleCells.map((cell) => cell.id));
  const visiblePeopleIds = new Set(visiblePeople.map((person) => person.id));
  const visibleTasks = getScopedCareTasks(currentUser, tasks, people, isDemoMode);
  const visibleReports = reports.filter((report) => visibleCellIds.has(report.cellId));
  const visibleVisits = getScopedSupervisorVisits(currentUser, visits, cells, isDemoMode);
  const visibleReminders = getScopedPastoralReminders(currentUser, reminders, cells, people, isDemoMode);
  const visiblePrayerRequests = getScopedPrayerRequests(currentUser, requests, cells, people, isDemoMode);
  const visibleEvents = getScopedActivityEvents(currentUser, events, cells, people, isDemoMode);
  const visibleAccesses = accesses.filter((access) => visiblePeopleIds.has(access.personId));
  const visibleProgress = progress.filter((item) => visiblePeopleIds.has(item.personId));

  const notifications = useMemo(
    () =>
      getPastoralNotifications({
        people: visiblePeople,
        cells: visibleCells,
        careTasks: visibleTasks,
        reports: visibleReports,
        visits: visibleVisits,
        reminders: visibleReminders,
        prayerRequests: visiblePrayerRequests,
        events: visibleEvents,
        accesses: visibleAccesses,
        progress: visibleProgress,
        tracks: discipleshipTracks,
      }),
    [
      visibleAccesses,
      visibleCells,
      visiblePeople,
      visiblePrayerRequests,
      visibleEvents,
      visibleProgress,
      visibleReminders,
      visibleReports,
      visibleTasks,
      visibleVisits,
      discipleshipTracks,
    ],
  );

  const unread = notifications.filter((notification) => !reads.readSet.has(notification.id));

  return { notifications, unread, ...reads };
}

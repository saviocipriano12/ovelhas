"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  getVisibleCareTasks,
  getVisibleCells,
  getVisiblePastoralReminders,
  getVisiblePeople,
  getVisiblePrayerRequests,
  getVisibleSupervisorVisits,
} from "@/lib/access-control";
import {
  useCareTasks,
  useCellReports,
  useCells,
  useCompletedCare,
  useDiscipleship,
  useLocalPeople,
  useNotificationReads,
  usePastoralReminders,
  usePrayerRequests,
  useSupervisorVisits,
} from "@/lib/local-store";
import { getPastoralNotifications } from "@/lib/notifications";

export function usePastoralNotifications() {
  const { currentUser } = useAuth();
  const { people } = useLocalPeople();
  const { cells } = useCells();
  const { tasks } = useCareTasks();
  const { completedSet } = useCompletedCare();
  const { reports } = useCellReports();
  const { visits } = useSupervisorVisits();
  const { reminders } = usePastoralReminders();
  const { requests } = usePrayerRequests();
  const { accesses, progress } = useDiscipleship();
  const reads = useNotificationReads(currentUser.id);

  const visiblePeople = getVisiblePeople(currentUser, people);
  const visibleCells = getVisibleCells(currentUser, cells);
  const visibleCellIds = new Set(visibleCells.map((cell) => cell.id));
  const visiblePeopleIds = new Set(visiblePeople.map((person) => person.id));
  const visibleTasks = getVisibleCareTasks(currentUser, tasks, people).filter((task) => !completedSet.has(task.id));
  const visibleReports = reports.filter((report) => visibleCellIds.has(report.cellId));
  const visibleVisits = getVisibleSupervisorVisits(currentUser, visits, cells);
  const visibleReminders = getVisiblePastoralReminders(currentUser, reminders, cells, people);
  const visiblePrayerRequests = getVisiblePrayerRequests(currentUser, requests, cells, people);
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
        accesses: visibleAccesses,
        progress: visibleProgress,
      }),
    [
      visibleAccesses,
      visibleCells,
      visiblePeople,
      visiblePrayerRequests,
      visibleProgress,
      visibleReminders,
      visibleReports,
      visibleTasks,
      visibleVisits,
    ],
  );

  const unread = notifications.filter((notification) => !reads.readSet.has(notification.id));

  return { notifications, unread, ...reads };
}

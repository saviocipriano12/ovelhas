"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ActivityEvent,
  AppUser,
  CareTask,
  Cell,
  CellReport,
  CellRsvp,
  CheckInEvent,
  ChurchSettings,
  CertificateRecord,
  DiscipleshipTrack,
  DiscipleshipVideo,
  Invite,
  LibraryMaterial,
  PastoralNote,
  PastoralReminder,
  Person,
  PersonTrackAccess,
  PrayerRequest,
  SupervisorVisit,
  UserRole,
  VideoProgressRecord,
} from "@/lib/data";
import {
  seedChurchSettings,
} from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import { mapSupabaseCell, mapSupabasePerson } from "@/lib/supabase/mappers";
import { enqueueOfflineAction } from "@/lib/offline-queue";

const PEOPLE_KEY = "ovelhas:people";
const CELLS_KEY = "ovelhas:cells";
const COMPLETED_CARE_KEY = "ovelhas:completed-care";
const CELL_REPORTS_KEY = "ovelhas:cell-reports";
const SUPERVISOR_VISITS_KEY = "ovelhas:supervisor-visits";
const ACTIVITY_EVENTS_KEY = "ovelhas:activity-events";
const PROFILES_KEY = "ovelhas:profiles";
const CARE_TASKS_KEY = "ovelhas:care-tasks";
const DISCIPLESHIP_TRACKS_KEY = "ovelhas:discipleship-tracks";
const DISCIPLESHIP_VIDEOS_KEY = "ovelhas:discipleship-videos";
const PERSON_TRACK_ACCESS_KEY = "ovelhas:person-track-access";
const VIDEO_PROGRESS_KEY = "ovelhas:video-progress";
const INVITES_KEY = "ovelhas:invites";
const PASTORAL_NOTES_KEY = "ovelhas:pastoral-notes";
const PASTORAL_REMINDERS_KEY = "ovelhas:pastoral-reminders";
const PRAYER_REQUESTS_KEY = "ovelhas:prayer-requests";
const CHURCH_SETTINGS_KEY = "ovelhas:church-settings";
const LIBRARY_MATERIALS_KEY = "ovelhas:library-materials";
const CERTIFICATES_KEY = "ovelhas:certificates";
const CHECKINS_KEY = "ovelhas:checkins";
const CELL_RSVPS_KEY = "ovelhas:cell-rsvps";
const NOTIFICATION_READS_KEY = "ovelhas:notification-reads";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function toIsoDate(value: string) {
  if (!value.includes("/")) {
    return value;
  }

  const [day, month, year] = value.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Hoje";
  }

  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function mapInviteRow(invite: {
  id: string;
  church_id: string;
  token: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  cell_id: string | null;
  created_by: string | null;
  status: Invite["status"];
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
}): Invite {
  return {
    id: invite.id,
    churchId: invite.church_id,
    token: invite.token,
    email: invite.email ?? "",
    name: invite.name ?? "",
    role: invite.role,
    cellId: invite.cell_id ?? "",
    createdBy: invite.created_by ?? "",
    status: invite.status,
    expiresAt: invite.expires_at,
    acceptedBy: invite.accepted_by ?? undefined,
    acceptedAt: invite.accepted_at ?? undefined,
    createdAt: invite.created_at,
  };
}

export function useLocalPeople() {
  const [items, setItems] = useState<Person[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    async function loadSupabasePeople() {
      const [peopleResult, cellsResult, profilesResult, progressResult, meetingsResult, serviceResult] = await Promise.all([
        supabase
          .from("people")
          .select("id, church_id, cell_id, person_user_id, created_by_user_id, leader_user_id, name, phone, email, birth_date, address, neighborhood, status, journey_stage, first_visit_date, notes"),
        supabase.from("cells").select("id, name, leader_id"),
        supabase.from("profiles").select("id, name"),
        supabase.from("video_progress").select("person_id, progress_percent"),
        supabase.from("cell_meetings").select("id, meeting_date, cell_attendance(person_id, present)").order("meeting_date", { ascending: false }).limit(8),
        supabase.from("service_attendance").select("person_id, present, church_services(service_date)").order("created_at", { ascending: false }).limit(200),
      ]);

      if (!peopleResult.error && peopleResult.data) {
        const cellNames = new Map((cellsResult.data ?? []).map((cell) => [cell.id, cell.name]));
        const cellLeaders = new Map((cellsResult.data ?? []).map((cell) => [cell.id, cell.leader_id ?? ""]));
        const profileNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.name]));
        const progressByPerson = new Map<string, number[]>();

        (progressResult.data ?? []).forEach((item) => {
          const values = progressByPerson.get(item.person_id) ?? [];
          values.push(item.progress_percent ?? 0);
          progressByPerson.set(item.person_id, values);
        });

        const absenceStreaks = new Map<string, number>();
        ((meetingsResult.data ?? []) as { cell_attendance?: { person_id: string; present: boolean }[] }[]).forEach((meeting) => {
          (meeting.cell_attendance ?? []).forEach((attendance) => {
            if (absenceStreaks.has(attendance.person_id)) {
              return;
            }

            absenceStreaks.set(attendance.person_id, attendance.present ? 0 : 1);
          });
        });

        const servicePresence = new Map<string, boolean>();
        ((serviceResult.data ?? []) as { person_id: string; present: boolean }[]).forEach((attendance) => {
          if (!servicePresence.has(attendance.person_id)) {
            servicePresence.set(attendance.person_id, attendance.present);
          }
        });

        setItems(
          peopleResult.data.map((person) => {
            const leaderId = person.leader_user_id ?? cellLeaders.get(person.cell_id ?? "") ?? "";
            const progressValues = progressByPerson.get(person.id) ?? [];
            const progress = progressValues.length
              ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
              : 0;

            return mapSupabasePerson(person, {
              cellName: cellNames.get(person.cell_id ?? "") ?? "Sem celula",
              leaderName: profileNames.get(leaderId) ?? "Sem lider",
              progress,
              cellAbsences: absenceStreaks.get(person.id) ?? 0,
              servicePresent: servicePresence.get(person.id) ?? false,
            });
          }),
        );
      }
    }

    loadSupabasePeople();
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(PEOPLE_KEY, items);
    }
  }, [hydrated, items]);

  async function addPerson(input: {
    name: string;
    phone: string;
    stage: string;
    neighborhood: string;
    email?: string;
    createdByUserId?: string;
    leaderUserId?: string;
    churchId?: string;
    cellId?: string;
    cellName?: string;
    persistToSupabase?: boolean;
  }): Promise<{ ok: boolean; person?: Person; error?: string }> {
    const idBase = slugify(input.name) || "pessoa";
    const localPerson: Person = {
      id: `${idBase}-${Date.now().toString().slice(-5)}`,
      name: input.name,
      initials: initialsFromName(input.name) || "NV",
      stage: input.stage,
      status: input.stage === "Visitante" ? "Boas-vindas" : "Novo cuidado",
      phone: input.phone.replace(/\D/g, ""),
      email: input.email || "",
      cell: input.cellName || "Casa da Paz",
      leader: "Rafael Lima",
      discipleshipLeader: "Rafael Lima",
      neighborhood: input.neighborhood,
      firstVisit: new Intl.DateTimeFormat("pt-BR").format(new Date()),
      birthday: "--/--",
      progress: 0,
      cellAbsences: 0,
      servicePresent: false,
      tone: "bg-teal-100 text-teal-800",
      churchId: input.churchId || "igreja-central",
      cellId: input.cellId || "cell-casa-da-paz",
      createdByUserId: input.createdByUserId || "leader-rafael",
      leaderUserId: input.leaderUserId || input.createdByUserId || "leader-rafael",
    };

    if (!input.persistToSupabase) {
      setItems((current) => [localPerson, ...current]);
      return { ok: true, person: localPerson };
    }

    const { data, error } = await supabase
      .from("people")
      .insert({
        church_id: input.churchId,
        cell_id: input.cellId || null,
        created_by_user_id: input.createdByUserId || null,
        leader_user_id: input.leaderUserId || null,
        name: input.name,
        phone: input.phone.replace(/\D/g, ""),
        email: input.email || null,
        neighborhood: input.neighborhood || null,
        status: input.stage,
        journey_stage: input.stage,
        first_visit_date: new Date().toISOString().slice(0, 10),
      })
      .select("id, church_id, cell_id, person_user_id, created_by_user_id, leader_user_id, name, phone, email, neighborhood, status, journey_stage, first_visit_date")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Nao foi possivel cadastrar a pessoa." };
    }

    const newPerson = mapSupabasePerson(data, { cellName: input.cellName });
    setItems((current) => [newPerson, ...current]);
    return { ok: true, person: newPerson };
  }

  function updatePeople(updater: (current: Person[]) => Person[]) {
    setItems((current) => updater(current));
  }

  async function updatePerson(
    personId: string,
    input: Partial<Pick<Person, "name" | "phone" | "email" | "stage" | "status" | "neighborhood" | "birthDate" | "address" | "maritalStatus" | "privateNotes">> & {
      persistToSupabase?: boolean;
    },
  ) {
    if (input.persistToSupabase) {
      const { error } = await supabase
        .from("people")
        .update({
          name: input.name,
          phone: input.phone?.replace(/\D/g, ""),
          email: input.email || null,
          birth_date: input.birthDate || null,
          address: input.address || null,
          neighborhood: input.neighborhood || null,
          status: input.status,
          journey_stage: input.stage,
          notes: input.privateNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", personId);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setItems((current) =>
      current.map((person) =>
        person.id === personId
          ? {
              ...person,
              name: input.name ?? person.name,
              initials: input.name ? initialsFromName(input.name) : person.initials,
              phone: input.phone ? input.phone.replace(/\D/g, "") : person.phone,
              email: input.email ?? person.email,
              stage: input.stage ?? person.stage,
              status: input.status ?? person.status,
              neighborhood: input.neighborhood ?? person.neighborhood,
              birthDate: input.birthDate ?? person.birthDate,
              address: input.address ?? person.address,
              maritalStatus: input.maritalStatus ?? person.maritalStatus,
              privateNotes: input.privateNotes ?? person.privateNotes,
            }
          : person,
      ),
    );

    return { ok: true };
  }

  return { people: items, addPerson, updatePeople, updatePerson };
}

export function useCells() {
  const [items, setItems] = useState<Cell[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    async function loadSupabaseCells() {
      const [{ data, error }, profilesResult] = await Promise.all([
        supabase
          .from("cells")
          .select("id, church_id, name, leader_id, supervisor_id, meeting_day, meeting_time, address, neighborhood, active"),
        supabase.from("profiles").select("id, name"),
      ]);

      if (!error && data) {
        const profileNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.name]));
        setItems(data.map((cell) => mapSupabaseCell(cell, profileNames.get(cell.leader_id ?? "") ?? "Sem lider")));
      }
    }

    loadSupabaseCells();
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(CELLS_KEY, items);
    }
  }, [hydrated, items]);

  async function addCell(input: {
    churchId: string;
    name: string;
    leaderUserId?: string;
    leaderName?: string;
    supervisorUserId?: string;
    meetingDay?: string;
    meetingTime?: string;
    address?: string;
    neighborhood?: string;
    persistToSupabase?: boolean;
  }) {
    const localCell: Cell = {
      id: `cell-${Date.now()}`,
      churchId: input.churchId,
      name: input.name,
      leaderUserId: input.leaderUserId ?? "",
      leaderName: input.leaderName ?? "Sem lider",
      supervisorUserId: input.supervisorUserId ?? "",
      meetingDay: input.meetingDay ?? "",
      meetingTime: input.meetingTime ?? "",
      address: input.address ?? "",
      neighborhood: input.neighborhood ?? "",
      active: true,
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("cells")
        .insert({
          church_id: input.churchId,
          name: input.name,
          leader_id: input.leaderUserId || null,
          supervisor_id: input.supervisorUserId || null,
          meeting_day: input.meetingDay || null,
          meeting_time: input.meetingTime || null,
          address: input.address || null,
          neighborhood: input.neighborhood || null,
          active: true,
        })
        .select("id, church_id, name, leader_id, supervisor_id, meeting_day, meeting_time, address, neighborhood, active")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localCell.id = data.id;
      }
    }

    setItems((current) => [localCell, ...current]);
    return { ok: true, cell: localCell };
  }

  async function updateCellAssignment(input: {
    cellId: string;
    leaderUserId: string;
    leaderName?: string;
    supervisorUserId: string;
    persistToSupabase?: boolean;
  }) {
    if (input.persistToSupabase) {
      const { error } = await supabase
        .from("cells")
        .update({
          leader_id: input.leaderUserId || null,
          supervisor_id: input.supervisorUserId || null,
        })
        .eq("id", input.cellId);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setItems((current) =>
      current.map((cell) =>
        cell.id === input.cellId
          ? {
              ...cell,
              leaderUserId: input.leaderUserId,
              leaderName: input.leaderName || cell.leaderName,
              supervisorUserId: input.supervisorUserId,
            }
          : cell,
      ),
    );

    return { ok: true };
  }

  return { cells: items, addCell, updateCellAssignment };
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<AppUser[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(PROFILES_KEY, profiles);
    }
  }, [hydrated, profiles]);

  useEffect(() => {
    async function loadSupabaseProfiles() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, church_id, name, role")
        .order("name", { ascending: true });

      if (!error && data) {
        setProfiles(
          data.map((profile) => ({
            id: profile.id,
            name: profile.name,
            role: profile.role as UserRole,
            churchId: profile.church_id ?? "sem-igreja",
          })),
        );
      }
    }

    loadSupabaseProfiles();
  }, []);

  async function updateProfileRole(input: {
    userId: string;
    role: UserRole;
    persistToSupabase?: boolean;
  }) {
    if (input.persistToSupabase) {
      const { error } = await supabase.from("profiles").update({ role: input.role }).eq("id", input.userId);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setProfiles((current) =>
      current.map((profile) => (profile.id === input.userId ? { ...profile, role: input.role } : profile)),
    );

    return { ok: true };
  }

  return { profiles, updateProfileRole };
}

export function useCompletedCare() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setCompleted(readJson<string[]>(COMPLETED_CARE_KEY, []));
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(COMPLETED_CARE_KEY, completed);
    }
  }, [completed, hydrated]);

  const completedSet = useMemo(() => new Set(completed), [completed]);

  function toggleCompleted(taskId: string) {
    setCompleted((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }

  return { completedSet, toggleCompleted };
}

export function useCareTasks() {
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(CARE_TASKS_KEY, tasks);
    }
  }, [hydrated, tasks]);

  useEffect(() => {
    async function loadSupabaseFollowUps() {
      const { data, error } = await supabase
        .from("follow_ups")
        .select("id, person_id, title, description, priority, due_date, status")
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTasks(
          data.map((task) => ({
              id: task.id,
              personId: task.person_id,
              title: task.title,
              description: task.description ?? "Acompanhamento pastoral pendente.",
              priority: (task.priority ?? "Media") as CareTask["priority"],
              due: formatDate(task.due_date),
              message: "Ola! Passando para saber como voce esta. Estamos aqui para caminhar com voce.",
            })),
        );
      }
    }

    loadSupabaseFollowUps();
  }, []);

  async function addCareTask(
    task: CareTask & {
      churchId?: string;
      assignedTo?: string;
      type?: string;
      persistToSupabase?: boolean;
    },
  ) {
    if (tasks.some((current) => current.id === task.id)) {
      return { ok: true };
    }

    if (task.persistToSupabase) {
      const { error } = await supabase.from("follow_ups").insert({
        church_id: task.churchId,
        person_id: task.personId,
        assigned_to: task.assignedTo || null,
        type: task.type || "ausencia",
        priority: task.priority,
        title: task.title,
        description: task.description,
        status: "open",
        due_date: new Date().toISOString().slice(0, 10),
      });

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setTasks((current) => [task, ...current]);
    return { ok: true };
  }

  async function completeCareTask(taskId: string, persistToSupabase?: boolean) {
    const now = new Date().toISOString();

    if (persistToSupabase) {
      const { error } = await supabase
        .from("follow_ups")
        .update({ status: "completed", completed_at: now })
        .eq("id", taskId);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setTasks((current) => current.filter((task) => task.id !== taskId));
    return { ok: true };
  }

  return { tasks, addCareTask, completeCareTask };
}

export function useCellReports() {
  const [reports, setReports] = useState<CellReport[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(CELL_REPORTS_KEY, reports);
    }
  }, [hydrated, reports]);

  useEffect(() => {
    async function loadSupabaseReports() {
      const [reportsResult, cellsResult, profilesResult] = await Promise.all([
        supabase
          .from("cell_reports")
          .select("id, cell_id, leader_id, supervisor_id, meeting_date, present_count, visitors_count, service_count, decisions_count, highlights, needs, prayer_requests, created_at"),
        supabase.from("cells").select("id, name"),
        supabase.from("profiles").select("id, name"),
      ]);

      if (!reportsResult.error && reportsResult.data) {
        const cellNames = new Map((cellsResult.data ?? []).map((cell) => [cell.id, cell.name]));
        const profileNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.name]));
        setReports(
          reportsResult.data.map((report) => ({
            id: report.id,
            cellId: report.cell_id,
            cellName: cellNames.get(report.cell_id) ?? "Celula",
            leaderUserId: report.leader_id ?? "",
            leaderName: profileNames.get(report.leader_id ?? "") ?? "Lider",
            supervisorUserId: report.supervisor_id ?? "",
            meetingDate: report.meeting_date,
            presentCount: report.present_count,
            visitorsCount: report.visitors_count,
            serviceCount: report.service_count,
            decisionsCount: report.decisions_count,
            highlights: report.highlights ?? "",
            needs: report.needs ?? "",
            prayerRequests: report.prayer_requests ?? "",
            createdAt: report.created_at,
          })),
        );
      }
    }

    loadSupabaseReports();
  }, []);

  async function addReport(report: Omit<CellReport, "id" | "createdAt"> & { churchId?: string; persistToSupabase?: boolean }): Promise<CellReport> {
    const localReport: CellReport = {
      ...report,
      id: `report-${report.cellId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (!report.persistToSupabase) {
      setReports((current) => [localReport, ...current]);
      return localReport;
    }

    const { data, error } = await supabase
      .from("cell_reports")
      .insert({
        church_id: report.churchId,
        cell_id: report.cellId,
        leader_id: report.leaderUserId || null,
        supervisor_id: report.supervisorUserId || null,
        meeting_date: toIsoDate(report.meetingDate),
        present_count: report.presentCount,
        visitors_count: report.visitorsCount,
        service_count: report.serviceCount,
        decisions_count: report.decisionsCount,
        highlights: report.highlights || null,
        needs: report.needs || null,
        prayer_requests: report.prayerRequests || null,
      })
      .select("id, created_at")
      .single();

    const newReport = !error && data ? { ...localReport, id: data.id, createdAt: data.created_at } : localReport;
    setReports((current) => [newReport, ...current]);
    return newReport;
  }

  return { reports, addReport };
}

export function useSupervisorVisits() {
  const [visits, setVisits] = useState<SupervisorVisit[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(SUPERVISOR_VISITS_KEY, visits);
    }
  }, [hydrated, visits]);

  useEffect(() => {
    async function loadSupabaseVisits() {
      const [visitsResult, cellsResult, profilesResult] = await Promise.all([
        supabase
          .from("supervisor_visits")
          .select("id, church_id, cell_id, supervisor_id, leader_id, visit_date, visit_type, leader_present, health_score, notes, next_steps, created_at"),
        supabase.from("cells").select("id, name"),
        supabase.from("profiles").select("id, name"),
      ]);

      if (!visitsResult.error && visitsResult.data) {
        const cellNames = new Map((cellsResult.data ?? []).map((cell) => [cell.id, cell.name]));
        const profileNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.name]));
        setVisits(
          visitsResult.data.map((visit) => ({
            id: visit.id,
            churchId: visit.church_id,
            cellId: visit.cell_id,
            cellName: cellNames.get(visit.cell_id) ?? "Celula",
            supervisorUserId: visit.supervisor_id ?? "",
            supervisorName: profileNames.get(visit.supervisor_id ?? "") ?? "Supervisor",
            leaderUserId: visit.leader_id ?? "",
            leaderName: profileNames.get(visit.leader_id ?? "") ?? "Lider",
            visitDate: visit.visit_date,
            visitType: visit.visit_type as "Presencial" | "Online" | "Ligacao",
            leaderPresent: visit.leader_present,
            healthScore: visit.health_score,
            notes: visit.notes ?? "",
            nextSteps: visit.next_steps ?? "",
            createdAt: visit.created_at,
          })),
        );
      }
    }

    loadSupabaseVisits();
  }, []);

  async function addVisit(visit: Omit<SupervisorVisit, "id" | "createdAt"> & { persistToSupabase?: boolean }): Promise<SupervisorVisit> {
    const localVisit: SupervisorVisit = {
      ...visit,
      id: `visit-${visit.cellId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (!visit.persistToSupabase) {
      setVisits((current) => [localVisit, ...current]);
      return localVisit;
    }

    const { data, error } = await supabase
      .from("supervisor_visits")
      .insert({
        church_id: visit.churchId,
        cell_id: visit.cellId,
        supervisor_id: visit.supervisorUserId,
        leader_id: visit.leaderUserId || null,
        visit_date: toIsoDate(visit.visitDate),
        visit_type: visit.visitType,
        leader_present: visit.leaderPresent,
        health_score: visit.healthScore,
        notes: visit.notes || null,
        next_steps: visit.nextSteps || null,
      })
      .select("id, created_at")
      .single();

    const newVisit = !error && data ? { ...localVisit, id: data.id, createdAt: data.created_at } : localVisit;
    setVisits((current) => [newVisit, ...current]);
    return newVisit;
  }

  return { visits, addVisit };
}

export function useActivityEvents() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(ACTIVITY_EVENTS_KEY, events);
    }
  }, [events, hydrated]);

  useEffect(() => {
    async function loadSupabaseEvents() {
      const { data, error } = await supabase
        .from("activity_events")
        .select("id, church_id, actor_user_id, actor_name, actor_role, action, description, target_type, target_id, target_name, cell_id, person_id, visibility, created_at");

      if (!error && data) {
        setEvents(
          data.map((event) => ({
            id: event.id,
            churchId: event.church_id,
            actorUserId: event.actor_user_id ?? "",
            actorName: event.actor_name,
            actorRole: event.actor_role as UserRole,
            action: event.action,
            description: event.description,
            targetType: event.target_type as ActivityEvent["targetType"],
            targetId: event.target_id ?? undefined,
            targetName: event.target_name ?? undefined,
            cellId: event.cell_id ?? undefined,
            personId: event.person_id ?? undefined,
            visibility: event.visibility as ActivityEvent["visibility"],
            createdAt: event.created_at,
          })),
        );
      }
    }

    loadSupabaseEvents();
  }, []);

  async function addEvent(event: Omit<ActivityEvent, "id" | "createdAt"> & { persistToSupabase?: boolean }): Promise<ActivityEvent> {
    const localEvent: ActivityEvent = {
      ...event,
      id: `activity-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (!event.persistToSupabase) {
      setEvents((current) => [localEvent, ...current]);
      return localEvent;
    }

    const { data, error } = await supabase
      .from("activity_events")
      .insert({
        church_id: event.churchId,
        actor_user_id: event.actorUserId,
        actor_name: event.actorName,
        actor_role: event.actorRole as UserRole,
        action: event.action,
        description: event.description,
        target_type: event.targetType,
        target_id: event.targetId || null,
        target_name: event.targetName || null,
        cell_id: event.cellId || null,
        person_id: event.personId || null,
        visibility: event.visibility,
      })
      .select("id, created_at")
      .single();

    const newEvent = !error && data ? { ...localEvent, id: data.id, createdAt: data.created_at } : localEvent;
    setEvents((current) => [newEvent, ...current]);
    return newEvent;
  }

  return { events, addEvent };
}

export function useDiscipleship() {
  const [tracks, setTracks] = useState<DiscipleshipTrack[]>([]);
  const [videos, setVideos] = useState<DiscipleshipVideo[]>([]);
  const [accesses, setAccesses] = useState<PersonTrackAccess[]>([]);
  const [progress, setProgress] = useState<VideoProgressRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(DISCIPLESHIP_TRACKS_KEY, tracks);
      writeJson(DISCIPLESHIP_VIDEOS_KEY, videos);
      writeJson(PERSON_TRACK_ACCESS_KEY, accesses);
      writeJson(VIDEO_PROGRESS_KEY, progress);
    }
  }, [accesses, hydrated, progress, tracks, videos]);

  useEffect(() => {
    async function loadDiscipleship() {
      const [tracksResult, videosResult, accessesResult, progressResult] = await Promise.all([
        supabase
          .from("discipleship_tracks")
          .select("id, church_id, title, description, cover_url, active, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("discipleship_videos")
          .select("id, track_id, title, description, video_url, thumbnail_url, duration_seconds, order_index, active, created_at")
          .order("order_index", { ascending: true }),
        supabase
          .from("person_track_access")
          .select("id, person_id, track_id, released_by, status, started_at, completed_at, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("video_progress")
          .select("id, person_id, video_id, status, progress_percent, started_at, completed_at, last_watched_at"),
      ]);

      if (!tracksResult.error && tracksResult.data) {
        setTracks(
          tracksResult.data.map((track) => ({
            id: track.id,
            churchId: track.church_id,
            title: track.title,
            description: track.description ?? "",
            coverUrl: track.cover_url ?? "",
            active: track.active,
            createdAt: track.created_at,
          })),
        );
      }

      if (!videosResult.error && videosResult.data) {
        setVideos(
          videosResult.data.map((video) => ({
            id: video.id,
            trackId: video.track_id,
            title: video.title,
            description: video.description ?? "",
            videoUrl: video.video_url,
            thumbnailUrl: video.thumbnail_url ?? "",
            durationSeconds: video.duration_seconds ?? 0,
            orderIndex: video.order_index,
            active: video.active,
            createdAt: video.created_at,
          })),
        );
      }

      if (!accessesResult.error && accessesResult.data) {
        setAccesses(
          accessesResult.data.map((access) => ({
            id: access.id,
            personId: access.person_id,
            trackId: access.track_id,
            releasedBy: access.released_by ?? "",
            status: access.status as PersonTrackAccess["status"],
            startedAt: access.started_at ?? undefined,
            completedAt: access.completed_at ?? undefined,
            createdAt: access.created_at,
          })),
        );
      }

      if (!progressResult.error && progressResult.data) {
        setProgress(
          progressResult.data.map((item) => ({
            id: item.id,
            personId: item.person_id,
            videoId: item.video_id,
            status: item.status as VideoProgressRecord["status"],
            progressPercent: item.progress_percent,
            startedAt: item.started_at ?? undefined,
            completedAt: item.completed_at ?? undefined,
            lastWatchedAt: item.last_watched_at ?? undefined,
          })),
        );
      }
    }

    loadDiscipleship();
  }, []);

  async function addTrack(input: {
    churchId: string;
    title: string;
    description: string;
    coverUrl?: string;
    persistToSupabase?: boolean;
  }) {
    const localTrack: DiscipleshipTrack = {
      id: `track-${slugify(input.title)}-${Date.now().toString().slice(-4)}`,
      churchId: input.churchId,
      title: input.title,
      description: input.description,
      coverUrl: input.coverUrl ?? "",
      active: true,
      createdAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("discipleship_tracks")
        .insert({
          church_id: input.churchId,
          title: input.title,
          description: input.description || null,
          cover_url: input.coverUrl || null,
          active: true,
        })
        .select("id, created_at")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localTrack.id = data.id;
        localTrack.createdAt = data.created_at;
      }
    }

    setTracks((current) => [localTrack, ...current]);
    return { ok: true, track: localTrack };
  }

  async function addVideo(input: {
    trackId: string;
    title: string;
    description: string;
    videoUrl: string;
    durationSeconds: number;
    orderIndex: number;
    persistToSupabase?: boolean;
  }) {
    const localVideo: DiscipleshipVideo = {
      id: `video-${slugify(input.title)}-${Date.now().toString().slice(-4)}`,
      trackId: input.trackId,
      title: input.title,
      description: input.description,
      videoUrl: input.videoUrl,
      thumbnailUrl: "",
      durationSeconds: input.durationSeconds,
      orderIndex: input.orderIndex,
      active: true,
      createdAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("discipleship_videos")
        .insert({
          track_id: input.trackId,
          title: input.title,
          description: input.description || null,
          video_url: input.videoUrl,
          duration_seconds: input.durationSeconds,
          order_index: input.orderIndex,
          active: true,
        })
        .select("id, created_at")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localVideo.id = data.id;
        localVideo.createdAt = data.created_at;
      }
    }

    setVideos((current) => [...current, localVideo].sort((a, b) => a.orderIndex - b.orderIndex));
    return { ok: true, video: localVideo };
  }

  async function releaseTrack(input: {
    personId: string;
    trackId: string;
    releasedBy: string;
    persistToSupabase?: boolean;
  }) {
    const existing = accesses.find((access) => access.personId === input.personId && access.trackId === input.trackId);
    if (existing) {
      return { ok: true, access: existing };
    }

    const localAccess: PersonTrackAccess = {
      id: `access-${input.personId}-${input.trackId}-${Date.now().toString().slice(-4)}`,
      personId: input.personId,
      trackId: input.trackId,
      releasedBy: input.releasedBy,
      status: "active",
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("person_track_access")
        .insert({
          person_id: input.personId,
          track_id: input.trackId,
          released_by: input.releasedBy,
          status: "active",
          started_at: new Date().toISOString(),
        })
        .select("id, created_at, started_at")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localAccess.id = data.id;
        localAccess.createdAt = data.created_at;
        localAccess.startedAt = data.started_at ?? undefined;
      }
    }

    setAccesses((current) => [localAccess, ...current]);
    return { ok: true, access: localAccess };
  }

  async function updateVideoProgress(input: {
    personId: string;
    videoId: string;
    progressPercent: number;
    persistToSupabase?: boolean;
  }) {
    const status: VideoProgressRecord["status"] = input.progressPercent >= 100 ? "completed" : "watching";
    const now = new Date().toISOString();
    const existing = progress.find((item) => item.personId === input.personId && item.videoId === input.videoId);
    const localProgress: VideoProgressRecord = {
      id: existing?.id ?? `progress-${input.personId}-${input.videoId}`,
      personId: input.personId,
      videoId: input.videoId,
      status,
      progressPercent: input.progressPercent,
      startedAt: existing?.startedAt ?? now,
      completedAt: status === "completed" ? now : existing?.completedAt,
      lastWatchedAt: now,
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("video_progress")
        .upsert(
          {
            person_id: input.personId,
            video_id: input.videoId,
            status,
            progress_percent: input.progressPercent,
            started_at: localProgress.startedAt,
            completed_at: localProgress.completedAt ?? null,
            last_watched_at: now,
          },
          { onConflict: "person_id,video_id" },
        )
        .select("id")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localProgress.id = data.id;
      }
    }

    setProgress((current) => {
      const others = current.filter((item) => !(item.personId === input.personId && item.videoId === input.videoId));
      return [localProgress, ...others];
    });

    return { ok: true, progress: localProgress };
  }

  return { tracks, videos, accesses, progress, addTrack, addVideo, releaseTrack, updateVideoProgress };
}

function createInviteToken() {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return random.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
}

export function useInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [inviteLoadError, setInviteLoadError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(INVITES_KEY, invites);
    }
  }, [hydrated, invites]);

  async function refreshInvites() {
    setIsLoadingInvites(true);
    setInviteLoadError("");

    const { data, error } = await supabase
      .from("invites")
      .select("id, church_id, token, email, name, role, cell_id, created_by, status, expires_at, accepted_by, accepted_at, created_at")
      .order("created_at", { ascending: false });

    setIsLoadingInvites(false);

    if (error) {
      setInviteLoadError(error.message);
      return { ok: false, error: error.message };
    }

    setInvites((data ?? []).map((invite) => mapInviteRow(invite)));
    return { ok: true, invites: data ?? [] };
  }

  useEffect(() => {
    queueMicrotask(() => {
      refreshInvites();
    });
  }, []);

  async function createInvite(input: {
    churchId: string;
    email: string;
    name: string;
    role: UserRole;
    cellId: string;
    createdBy: string;
    persistToSupabase?: boolean;
  }) {
    const localInvite: Invite = {
      id: `invite-${Date.now()}`,
      churchId: input.churchId,
      token: createInviteToken(),
      email: input.email,
      name: input.name,
      role: input.role,
      cellId: input.cellId,
      createdBy: input.createdBy,
      status: "pending",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      createdAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("invites")
        .insert({
          church_id: input.churchId,
          token: localInvite.token,
          email: input.email || null,
          name: input.name || null,
          role: input.role,
          cell_id: input.cellId || null,
          created_by: input.createdBy,
          status: "pending",
          expires_at: localInvite.expiresAt,
        })
        .select("id, created_at")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localInvite.id = data.id;
        localInvite.createdAt = data.created_at;
      }
    }

    setInvites((current) => [localInvite, ...current]);
    return { ok: true, invite: localInvite };
  }

  return { invites, createInvite, refreshInvites, isLoadingInvites, inviteLoadError };
}

export function usePastoralNotes() {
  const [notes, setNotes] = useState<PastoralNote[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(PASTORAL_NOTES_KEY, notes);
    }
  }, [hydrated, notes]);

  useEffect(() => {
    async function loadSupabaseNotes() {
      const { data, error } = await supabase
        .from("pastoral_notes")
        .select("id, person_id, created_by, note, visibility, created_at")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setNotes(
          data.map((note) => ({
            id: note.id,
            personId: note.person_id,
            createdBy: note.created_by ?? "",
            createdByName: "Lideranca",
            note: note.note,
            visibility: note.visibility as PastoralNote["visibility"],
            createdAt: note.created_at,
          })),
        );
      }
    }

    loadSupabaseNotes();
  }, []);

  async function addNote(input: {
    personId: string;
    createdBy: string;
    createdByName: string;
    note: string;
    visibility: PastoralNote["visibility"];
    persistToSupabase?: boolean;
  }) {
    const localNote: PastoralNote = {
      id: `note-${input.personId}-${Date.now()}`,
      personId: input.personId,
      createdBy: input.createdBy,
      createdByName: input.createdByName,
      note: input.note,
      visibility: input.visibility,
      createdAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("pastoral_notes")
        .insert({
          person_id: input.personId,
          created_by: input.createdBy,
          note: input.note,
          visibility: input.visibility,
        })
        .select("id, created_at")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localNote.id = data.id;
        localNote.createdAt = data.created_at;
      }
    }

    setNotes((current) => [localNote, ...current]);
    return { ok: true, note: localNote };
  }

  return { notes, addNote };
}

export function usePastoralReminders() {
  const [reminders, setReminders] = useState<PastoralReminder[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(PASTORAL_REMINDERS_KEY, reminders);
    }
  }, [hydrated, reminders]);

  useEffect(() => {
    async function loadSupabaseReminders() {
      const { data, error } = await supabase
        .from("pastoral_reminders")
        .select("id, church_id, assigned_to, title, description, reminder_type, due_at, status, person_id, cell_id, created_by, created_at, completed_at")
        .order("due_at", { ascending: true });

      if (!error && data) {
        setReminders(
          data.map((reminder) => ({
            id: reminder.id,
            churchId: reminder.church_id,
            assignedTo: reminder.assigned_to ?? "",
            title: reminder.title,
            description: reminder.description ?? "",
            reminderType: reminder.reminder_type as PastoralReminder["reminderType"],
            dueAt: reminder.due_at,
            status: reminder.status as PastoralReminder["status"],
            personId: reminder.person_id ?? undefined,
            cellId: reminder.cell_id ?? undefined,
            createdBy: reminder.created_by ?? "",
            createdAt: reminder.created_at,
            completedAt: reminder.completed_at ?? undefined,
          })),
        );
      }
    }

    loadSupabaseReminders();
  }, []);

  async function addReminder(input: {
    churchId: string;
    assignedTo: string;
    title: string;
    description: string;
    reminderType: PastoralReminder["reminderType"];
    dueAt: string;
    personId?: string;
    cellId?: string;
    createdBy: string;
    persistToSupabase?: boolean;
  }) {
    const localReminder: PastoralReminder = {
      id: `reminder-${Date.now()}`,
      churchId: input.churchId,
      assignedTo: input.assignedTo,
      title: input.title,
      description: input.description,
      reminderType: input.reminderType,
      dueAt: input.dueAt,
      status: "open",
      personId: input.personId,
      cellId: input.cellId,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("pastoral_reminders")
        .insert({
          church_id: input.churchId,
          assigned_to: input.assignedTo,
          title: input.title,
          description: input.description || null,
          reminder_type: input.reminderType,
          due_at: input.dueAt,
          person_id: input.personId || null,
          cell_id: input.cellId || null,
          created_by: input.createdBy,
          status: "open",
        })
        .select("id, created_at")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localReminder.id = data.id;
        localReminder.createdAt = data.created_at;
      }
    }

    setReminders((current) => [localReminder, ...current].sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
    return { ok: true, reminder: localReminder };
  }

  async function completeReminder(reminderId: string, persistToSupabase?: boolean) {
    const now = new Date().toISOString();

    if (persistToSupabase) {
      const { error } = await supabase
        .from("pastoral_reminders")
        .update({ status: "completed", completed_at: now })
        .eq("id", reminderId);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setReminders((current) =>
      current.map((reminder) =>
        reminder.id === reminderId ? { ...reminder, status: "completed", completedAt: now } : reminder,
      ),
    );

    return { ok: true };
  }

  return { reminders, addReminder, completeReminder };
}

export function usePrayerRequests() {
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeJson(PRAYER_REQUESTS_KEY, requests);
    }
  }, [hydrated, requests]);

  useEffect(() => {
    async function loadSupabasePrayerRequests() {
      const { data, error } = await supabase
        .from("prayer_requests")
        .select("id, church_id, person_id, cell_id, title, request, visibility, status, created_by, created_by_name, answered_note, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setRequests(
          data.map((request) => ({
            id: request.id,
            churchId: request.church_id,
            personId: request.person_id,
            cellId: request.cell_id ?? undefined,
            title: request.title,
            request: request.request,
            visibility: request.visibility as PrayerRequest["visibility"],
            status: request.status as PrayerRequest["status"],
            createdBy: request.created_by ?? "",
            createdByName: request.created_by_name ?? "Membro",
            answeredNote: request.answered_note ?? undefined,
            createdAt: request.created_at,
            updatedAt: request.updated_at ?? undefined,
          })),
        );
      }
    }

    loadSupabasePrayerRequests();
  }, []);

  async function addPrayerRequest(input: {
    churchId: string;
    personId: string;
    cellId?: string;
    title: string;
    request: string;
    visibility: PrayerRequest["visibility"];
    createdBy: string;
    createdByName: string;
    persistToSupabase?: boolean;
  }) {
    const localRequest: PrayerRequest = {
      id: `prayer-${Date.now()}`,
      churchId: input.churchId,
      personId: input.personId,
      cellId: input.cellId,
      title: input.title,
      request: input.request,
      visibility: input.visibility,
      status: "open",
      createdBy: input.createdBy,
      createdByName: input.createdByName,
      createdAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("prayer_requests")
        .insert({
          church_id: input.churchId,
          person_id: input.personId,
          cell_id: input.cellId || null,
          title: input.title,
          request: input.request,
          visibility: input.visibility,
          status: "open",
          created_by: input.createdBy,
          created_by_name: input.createdByName,
        })
        .select("id, created_at")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localRequest.id = data.id;
        localRequest.createdAt = data.created_at;
      }
    }

    setRequests((current) => [localRequest, ...current]);
    return { ok: true, request: localRequest };
  }

  async function updatePrayerStatus(input: {
    requestId: string;
    status: PrayerRequest["status"];
    answeredNote?: string;
    persistToSupabase?: boolean;
  }) {
    const updatedAt = new Date().toISOString();

    if (input.persistToSupabase) {
      const { error } = await supabase
        .from("prayer_requests")
        .update({
          status: input.status,
          answered_note: input.answeredNote || null,
          updated_at: updatedAt,
        })
        .eq("id", input.requestId);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setRequests((current) =>
      current.map((request) =>
        request.id === input.requestId
          ? {
              ...request,
              status: input.status,
              answeredNote: input.answeredNote ?? request.answeredNote,
              updatedAt,
            }
          : request,
      ),
    );

    return { ok: true };
  }

  return { requests, addPrayerRequest, updatePrayerStatus };
}

export function useChurchSettings(churchId: string) {
  const storageKey = `${CHURCH_SETTINGS_KEY}:${churchId || "demo"}`;
  const [settings, setSettings] = useState<ChurchSettings>({ ...seedChurchSettings, churchId });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setSettings(readJson<ChurchSettings>(storageKey, { ...seedChurchSettings, churchId }));
      setHydrated(true);
    });
  }, [churchId, storageKey]);

  useEffect(() => {
    if (hydrated) {
      writeJson(storageKey, settings);
    }
  }, [hydrated, settings, storageKey]);

  useEffect(() => {
    async function loadSupabaseSettings() {
      if (!churchId || churchId === "igreja-central") {
        return;
      }

      const [{ data: church }, { data: churchSettings }] = await Promise.all([
        supabase.from("churches").select("id, name, city, state").eq("id", churchId).maybeSingle(),
        supabase
          .from("church_settings")
          .select("church_id, logo_url, primary_color, welcome_message, absence_message, discipleship_message, privacy_contact, terms_text, updated_at")
          .eq("church_id", churchId)
          .maybeSingle(),
      ]);

      if (church || churchSettings) {
        setSettings((current) => ({
          ...current,
          churchId,
          churchName: church?.name ?? current.churchName,
          city: church?.city ?? current.city,
          state: church?.state ?? current.state,
          logoUrl: churchSettings?.logo_url ?? current.logoUrl,
          primaryColor: churchSettings?.primary_color ?? current.primaryColor,
          welcomeMessage: churchSettings?.welcome_message ?? current.welcomeMessage,
          absenceMessage: churchSettings?.absence_message ?? current.absenceMessage,
          discipleshipMessage: churchSettings?.discipleship_message ?? current.discipleshipMessage,
          privacyContact: churchSettings?.privacy_contact ?? current.privacyContact,
          termsText: churchSettings?.terms_text ?? current.termsText,
          updatedAt: churchSettings?.updated_at ?? current.updatedAt,
        }));
      }
    }

    loadSupabaseSettings();
  }, [churchId]);

  async function updateSettings(input: Partial<ChurchSettings> & { persistToSupabase?: boolean }) {
    const nextSettings: ChurchSettings = {
      ...settings,
      ...input,
      churchId,
      updatedAt: new Date().toISOString(),
    };

    if (input.persistToSupabase && churchId) {
      const { error: churchError } = await supabase
        .from("churches")
        .update({
          name: nextSettings.churchName,
          city: nextSettings.city || null,
          state: nextSettings.state || null,
        })
        .eq("id", churchId);

      if (churchError) {
        return { ok: false, error: churchError.message };
      }

      const { error: settingsError } = await supabase.from("church_settings").upsert(
        {
          church_id: churchId,
          logo_url: nextSettings.logoUrl || null,
          primary_color: nextSettings.primaryColor,
          welcome_message: nextSettings.welcomeMessage,
          absence_message: nextSettings.absenceMessage,
          discipleship_message: nextSettings.discipleshipMessage,
          privacy_contact: nextSettings.privacyContact,
          terms_text: nextSettings.termsText,
          updated_at: nextSettings.updatedAt,
        },
        { onConflict: "church_id" },
      );

      if (settingsError) {
        return { ok: false, error: settingsError.message };
      }
    }

    setSettings(nextSettings);
    return { ok: true, settings: nextSettings };
  }

  return { settings, updateSettings };
}

export function useLibraryMaterials(churchId: string) {
  const storageKey = `${LIBRARY_MATERIALS_KEY}:${churchId || "demo"}`;
  const [materials, setMaterials] = useState<LibraryMaterial[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) {
      writeJson(storageKey, materials);
    }
  }, [hydrated, materials, storageKey]);

  useEffect(() => {
    async function loadSupabaseMaterials() {
      const { data, error } = await supabase
        .from("library_materials")
        .select("id, church_id, track_id, title, description, material_type, url, audience, active, created_by, created_at")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setMaterials(
          data.map((material) => ({
            id: material.id,
            churchId: material.church_id,
            trackId: material.track_id ?? undefined,
            title: material.title,
            description: material.description ?? "",
            materialType: material.material_type as LibraryMaterial["materialType"],
            url: material.url,
            audience: material.audience as LibraryMaterial["audience"],
            active: material.active,
            createdBy: material.created_by ?? "",
            createdAt: material.created_at,
          })),
        );
      }
    }

    loadSupabaseMaterials();
  }, []);

  async function addMaterial(input: Omit<LibraryMaterial, "id" | "createdAt" | "active"> & { persistToSupabase?: boolean }) {
    const localMaterial: LibraryMaterial = {
      ...input,
      id: `material-${Date.now()}`,
      active: true,
      createdAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("library_materials")
        .insert({
          church_id: input.churchId,
          track_id: input.trackId || null,
          title: input.title,
          description: input.description || null,
          material_type: input.materialType,
          url: input.url,
          audience: input.audience,
          active: true,
          created_by: input.createdBy,
        })
        .select("id, created_at")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localMaterial.id = data.id;
        localMaterial.createdAt = data.created_at;
      }
    }

    setMaterials((current) => [localMaterial, ...current]);
    return { ok: true, material: localMaterial };
  }

  return { materials, addMaterial };
}

export function useCertificates(churchId: string) {
  const storageKey = `${CERTIFICATES_KEY}:${churchId || "demo"}`;
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) {
      writeJson(storageKey, certificates);
    }
  }, [certificates, hydrated, storageKey]);

  useEffect(() => {
    async function loadSupabaseCertificates() {
      const { data, error } = await supabase
        .from("certificates")
        .select("id, church_id, person_id, track_id, title, issued_by, issued_by_name, issued_at")
        .order("issued_at", { ascending: false });

      if (!error && data) {
        setCertificates(
          data.map((certificate) => ({
            id: certificate.id,
            churchId: certificate.church_id,
            personId: certificate.person_id,
            trackId: certificate.track_id,
            title: certificate.title,
            issuedBy: certificate.issued_by ?? "",
            issuedByName: certificate.issued_by_name ?? "Lideranca",
            issuedAt: certificate.issued_at,
          })),
        );
      }
    }

    loadSupabaseCertificates();
  }, []);

  async function issueCertificate(input: Omit<CertificateRecord, "id" | "issuedAt"> & { persistToSupabase?: boolean }) {
    const existing = certificates.find(
      (certificate) => certificate.personId === input.personId && certificate.trackId === input.trackId,
    );

    if (existing) {
      return { ok: true, certificate: existing };
    }

    const localCertificate: CertificateRecord = {
      ...input,
      id: `certificate-${Date.now()}`,
      issuedAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("certificates")
        .insert({
          church_id: input.churchId,
          person_id: input.personId,
          track_id: input.trackId,
          title: input.title,
          issued_by: input.issuedBy,
          issued_by_name: input.issuedByName,
          issued_at: localCertificate.issuedAt,
        })
        .select("id, issued_at")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localCertificate.id = data.id;
        localCertificate.issuedAt = data.issued_at;
      }
    }

    setCertificates((current) => [localCertificate, ...current]);
    return { ok: true, certificate: localCertificate };
  }

  return { certificates, issueCertificate };
}

export function useCheckIns(churchId: string) {
  const storageKey = `${CHECKINS_KEY}:${churchId || "demo"}`;
  const [checkIns, setCheckIns] = useState<CheckInEvent[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) {
      writeJson(storageKey, checkIns);
    }
  }, [checkIns, hydrated, storageKey]);

  useEffect(() => {
    async function loadSupabaseCheckIns() {
      const { data, error } = await supabase
        .from("checkins")
        .select("id, church_id, cell_id, person_id, person_name, checkin_type, checkin_date, created_at")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCheckIns(
          data.map((checkin) => ({
            id: checkin.id,
            churchId: checkin.church_id,
            cellId: checkin.cell_id,
            personId: checkin.person_id ?? undefined,
            personName: checkin.person_name,
            checkinType: checkin.checkin_type as CheckInEvent["checkinType"],
            checkinDate: checkin.checkin_date,
            createdAt: checkin.created_at,
          })),
        );
      }
    }

    loadSupabaseCheckIns();
  }, []);

  async function addCheckIn(input: Omit<CheckInEvent, "id" | "createdAt"> & { persistToSupabase?: boolean }) {
    const todayAlready = checkIns.find(
      (checkin) =>
        checkin.cellId === input.cellId &&
        checkin.checkinDate === input.checkinDate &&
        checkin.checkinType === input.checkinType &&
        ((input.personId && checkin.personId === input.personId) || checkin.personName === input.personName),
    );

    if (todayAlready) {
      return { ok: true, checkIn: todayAlready };
    }

    const localCheckIn: CheckInEvent = {
      ...input,
      id: `checkin-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("checkins")
        .insert({
          church_id: input.churchId,
          cell_id: input.cellId,
          person_id: input.personId || null,
          person_name: input.personName,
          checkin_type: input.checkinType,
          checkin_date: input.checkinDate,
        })
        .select("id, created_at")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localCheckIn.id = data.id;
        localCheckIn.createdAt = data.created_at;
      }
    }

    setCheckIns((current) => [localCheckIn, ...current]);
    return { ok: true, checkIn: localCheckIn };
  }

  return { checkIns, addCheckIn };
}

export function useCellRsvps(churchId: string) {
  const storageKey = `${CELL_RSVPS_KEY}:${churchId || "demo"}`;
  const [rsvps, setRsvps] = useState<CellRsvp[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) {
      writeJson(storageKey, rsvps);
    }
  }, [hydrated, rsvps, storageKey]);

  useEffect(() => {
    async function loadSupabaseRsvps() {
      const { data, error } = await supabase
        .from("cell_rsvps")
        .select("id, church_id, cell_id, person_id, person_name, meeting_date, response, note, created_at, updated_at")
        .eq("church_id", churchId)
        .order("meeting_date", { ascending: true });

      if (!error && data) {
        setRsvps(
          data.map((rsvp) => ({
            id: rsvp.id,
            churchId: rsvp.church_id,
            cellId: rsvp.cell_id,
            personId: rsvp.person_id,
            personName: rsvp.person_name,
            meetingDate: rsvp.meeting_date,
            response: rsvp.response as CellRsvp["response"],
            note: rsvp.note ?? undefined,
            createdAt: rsvp.created_at,
            updatedAt: rsvp.updated_at,
          })),
        );
      }
    }

    if (churchId) {
      loadSupabaseRsvps();
    }
  }, [churchId]);

  async function saveRsvp(input: Omit<CellRsvp, "id" | "createdAt" | "updatedAt"> & { persistToSupabase?: boolean }) {
    const now = new Date().toISOString();
    const existing = rsvps.find(
      (rsvp) => rsvp.personId === input.personId && rsvp.cellId === input.cellId && rsvp.meetingDate === input.meetingDate,
    );
    const localRsvp: CellRsvp = {
      ...input,
      id: existing?.id ?? `rsvp-${input.personId}-${input.meetingDate}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (input.persistToSupabase) {
      const { data, error } = await supabase
        .from("cell_rsvps")
        .upsert(
          {
            church_id: input.churchId,
            cell_id: input.cellId,
            person_id: input.personId,
            person_name: input.personName,
            meeting_date: input.meetingDate,
            response: input.response,
            note: input.note || null,
            updated_at: now,
          },
          { onConflict: "person_id,cell_id,meeting_date" },
        )
        .select("id, created_at, updated_at")
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        localRsvp.id = data.id;
        localRsvp.createdAt = data.created_at;
        localRsvp.updatedAt = data.updated_at;
      }
    }

    setRsvps((current) => {
      const others = current.filter(
        (rsvp) => !(rsvp.personId === input.personId && rsvp.cellId === input.cellId && rsvp.meetingDate === input.meetingDate),
      );
      return [localRsvp, ...others];
    });

    return { ok: true, rsvp: localRsvp };
  }

  return { rsvps, saveRsvp };
}

export function useNotificationReads(userId: string) {
  const storageKey = `${NOTIFICATION_READS_KEY}:${userId}`;
  const [readIds, setReadIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setReadIds(readJson<string[]>(storageKey, []));
      setHydrated(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) {
      writeJson(storageKey, readIds);
    }
  }, [hydrated, readIds, storageKey]);

  function markRead(notificationId: string) {
    setReadIds((current) => (current.includes(notificationId) ? current : [...current, notificationId]));
  }

  function markUnread(notificationId: string) {
    setReadIds((current) => current.filter((id) => id !== notificationId));
  }

  function markAllRead(notificationIds: string[]) {
    setReadIds((current) => Array.from(new Set([...current, ...notificationIds])));
  }

  return { readSet: new Set(readIds), markRead, markUnread, markAllRead };
}

export async function getInviteByToken(token: string): Promise<Invite | null> {
  const { data, error } = await supabase.rpc("get_invite_by_token", { invite_token: token }).maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapInviteRow(data as Parameters<typeof mapInviteRow>[0]);
}

export async function acceptInvite(token: string) {
  const { error } = await supabase.rpc("accept_invite", { invite_token: token });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function saveVideoReflection(input: {
  personId: string;
  videoId: string;
  answer: string;
  question?: string;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("video_reflections").upsert(
    {
      person_id: input.personId,
      video_id: input.videoId,
      question: input.question || "Reflexao",
      answer: input.answer,
      updated_at: now,
    },
    { onConflict: "person_id,video_id,question" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function saveCellAttendance(input: {
  churchId: string;
  cellId: string;
  meetingDate: string;
  createdBy: string;
  visitorsCount: number;
  notes?: string;
  records: { personId: string; present: boolean; notes?: string }[];
}) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueOfflineAction({ type: "cell-attendance", payload: input });
    return { ok: true, queued: true };
  }

  const { data: meeting, error: meetingError } = await supabase
    .from("cell_meetings")
    .insert({
      cell_id: input.cellId,
      meeting_date: input.meetingDate,
      visitors_count: input.visitorsCount,
      notes: input.notes || null,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (meetingError || !meeting) {
    enqueueOfflineAction({ type: "cell-attendance", payload: input });
    return { ok: false, error: meetingError?.message ?? "Nao foi possivel criar a reuniao." };
  }

  const { error: attendanceError } = await supabase.from("cell_attendance").insert(
    input.records.map((record) => ({
      meeting_id: meeting.id,
      person_id: record.personId,
      present: record.present,
      notes: record.notes || null,
    })),
  );

  if (attendanceError) {
    enqueueOfflineAction({ type: "cell-attendance", payload: input });
    return { ok: false, error: attendanceError.message };
  }

  return { ok: true, meetingId: meeting.id as string };
}

export async function saveServiceAttendance(input: {
  churchId: string;
  serviceDate: string;
  title: string;
  createdBy: string;
  records: { personId: string; present: boolean }[];
}) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueOfflineAction({ type: "service-attendance", payload: input });
    return { ok: true, queued: true };
  }

  const { data: service, error: serviceError } = await supabase
    .from("church_services")
    .insert({
      church_id: input.churchId,
      service_date: input.serviceDate,
      title: input.title,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (serviceError || !service) {
    enqueueOfflineAction({ type: "service-attendance", payload: input });
    return { ok: false, error: serviceError?.message ?? "Nao foi possivel criar o culto." };
  }

  const { error: attendanceError } = await supabase.from("service_attendance").insert(
    input.records.map((record) => ({
      service_id: service.id,
      person_id: record.personId,
      present: record.present,
    })),
  );

  if (attendanceError) {
    enqueueOfflineAction({ type: "service-attendance", payload: input });
    return { ok: false, error: attendanceError.message };
  }

  return { ok: true, serviceId: service.id as string };
}

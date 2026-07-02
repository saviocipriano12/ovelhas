"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ActivityEvent,
  AppUser,
  CareTask,
  Cell,
  ConsolidationReport,
  ConsolidationVisitor,
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
import { enqueueOfflineAction, useOfflineSyncSuccess } from "@/lib/offline-queue";

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
const CONSOLIDATION_REPORTS_KEY = "ovelhas:consolidation-reports";

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
  person_id?: string | null;
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
    personId: invite.person_id ?? undefined,
    createdBy: invite.created_by ?? "",
    status: invite.status,
    expiresAt: invite.expires_at,
    acceptedBy: invite.accepted_by ?? undefined,
    acceptedAt: invite.accepted_at ?? undefined,
    createdAt: invite.created_at,
  };
}

function isMissingRpc(message?: string) {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("could not find the function") || (lower.includes("function") && lower.includes("does not exist"));
}

function isMissingColumn(message: string | undefined, columns: string[]) {
  const lower = (message ?? "").toLowerCase();
  return columns.some((column) => lower.includes(column.toLowerCase())) || lower.includes("schema cache");
}

export function useLocalPeople() {
  const [items, setItems] = useState<Person[]>([]);
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);
  const [peopleLoadError, setPeopleLoadError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  async function refreshPeople() {
    setIsLoadingPeople(true);
    setPeopleLoadError("");

    const peopleRpcResult = await supabase.rpc("get_my_people");
    const peopleQuery = peopleRpcResult.error && isMissingRpc(peopleRpcResult.error.message)
      ? supabase
          .from("people")
          .select("id, church_id, cell_id, person_user_id, created_by_user_id, leader_user_id, name, phone, email, birth_date, address, photo_url, family_phone, neighborhood, status, journey_stage, first_visit_date, notes")
      : Promise.resolve(peopleRpcResult);

    const [initialPeopleResult, cellsRpcResult, profilesRpcResult, progressResult, meetingsResult, serviceResult] = await Promise.all([
      peopleQuery,
      supabase.rpc("get_my_cells"),
      supabase.rpc("get_my_profiles"),
      supabase.from("video_progress").select("person_id, progress_percent"),
      supabase.from("cell_meetings").select("id, meeting_date, cell_attendance(person_id, present)").order("meeting_date", { ascending: false }).limit(8),
      supabase.from("service_attendance").select("person_id, present, church_services(service_date)").order("created_at", { ascending: false }).limit(200),
    ]);
    let peopleResult = initialPeopleResult;

    if (peopleResult.error && isMissingColumn(peopleResult.error.message, ["photo_url", "family_phone"])) {
      peopleResult = await supabase
        .from("people")
        .select("id, church_id, cell_id, person_user_id, created_by_user_id, leader_user_id, name, phone, email, birth_date, address, neighborhood, status, journey_stage, first_visit_date, notes");
    }

    const [cellsResult, profilesResult] = await Promise.all([
      cellsRpcResult.error && isMissingRpc(cellsRpcResult.error.message)
        ? supabase.from("cells").select("id, name, leader_id")
        : Promise.resolve(cellsRpcResult),
      profilesRpcResult.error && isMissingRpc(profilesRpcResult.error.message)
        ? supabase.from("profiles").select("id, name")
        : Promise.resolve(profilesRpcResult),
    ]);

    setIsLoadingPeople(false);

    if (peopleResult.error) {
      setPeopleLoadError(peopleResult.error.message);
      return { ok: false, error: peopleResult.error.message };
    }

    const cellRows = (cellsResult.data ?? []) as { id: string; name: string; leader_id?: string | null }[];
    const profileRows = (profilesResult.data ?? []) as { id: string; name: string }[];
    const cellNames = new Map(cellRows.map((cell) => [cell.id, cell.name]));
    const cellLeaders = new Map(cellRows.map((cell) => [cell.id, cell.leader_id ?? ""]));
    const profileNames = new Map(profileRows.map((profile) => [profile.id, profile.name]));
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

    const mappedPeople = ((peopleResult.data ?? []) as Parameters<typeof mapSupabasePerson>[0][]).map((person) => {
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
    });

    setItems(mappedPeople);
    return { ok: true, people: mappedPeople };
  }

  useEffect(() => {
    queueMicrotask(() => {
      refreshPeople();
    });
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
    birthDate?: string;
    address?: string;
    photoUrl?: string;
    familyPhone?: string;
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
      birthDate: input.birthDate || "",
      address: input.address || "",
      familyPhone: input.familyPhone?.replace(/\D/g, "") || "",
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

    const legacyInsertPayload = {
      church_id: input.churchId,
      cell_id: input.cellId || null,
      created_by_user_id: input.createdByUserId || null,
      leader_user_id: input.leaderUserId || null,
      name: input.name,
      phone: input.phone.replace(/\D/g, ""),
      email: input.email || null,
      birth_date: input.birthDate || null,
      address: input.address || null,
      neighborhood: input.neighborhood || null,
      status: input.stage,
      journey_stage: input.stage,
      first_visit_date: new Date().toISOString().slice(0, 10),
    };
    const insertPayload = {
      ...legacyInsertPayload,
      photo_url: input.photoUrl || null,
      family_phone: input.familyPhone?.replace(/\D/g, "") || null,
    };
    const insertPerson = async (includeExtendedColumns: boolean) => {
      return supabase
        .from("people")
        .insert(includeExtendedColumns ? insertPayload : legacyInsertPayload)
        .select(
          includeExtendedColumns
            ? "id, church_id, cell_id, person_user_id, created_by_user_id, leader_user_id, name, phone, email, birth_date, address, photo_url, family_phone, neighborhood, status, journey_stage, first_visit_date, notes"
            : "id, church_id, cell_id, person_user_id, created_by_user_id, leader_user_id, name, phone, email, birth_date, address, neighborhood, status, journey_stage, first_visit_date, notes",
        )
        .single();
    };
    const firstInsert = await insertPerson(true);
    const retryInsert =
      isMissingColumn(firstInsert.error?.message, ["photo_url", "family_phone"])
        ? await insertPerson(false)
        : null;
    const { data, error } = retryInsert ?? firstInsert;

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Nao foi possivel cadastrar a pessoa." };
    }

    const newPerson = mapSupabasePerson(data as unknown as Parameters<typeof mapSupabasePerson>[0], { cellName: input.cellName });
    setItems((current) => [newPerson, ...current]);
    return { ok: true, person: newPerson };
  }

  function updatePeople(updater: (current: Person[]) => Person[]) {
    setItems((current) => updater(current));
  }

  async function updatePerson(
    personId: string,
    input: Partial<Pick<Person, "name" | "phone" | "email" | "stage" | "status" | "neighborhood" | "birthDate" | "address" | "familyPhone" | "maritalStatus" | "privateNotes" | "photoUrl">> & {
      persistToSupabase?: boolean;
    },
  ) {
    if (input.persistToSupabase) {
      const legacyUpdatePayload = {
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
        };
      const updatePayload = {
        ...legacyUpdatePayload,
        photo_url: input.photoUrl || null,
        family_phone: input.familyPhone?.replace(/\D/g, "") || null,
      };
      const updateRecord = async (includeExtendedColumns: boolean) => {
        return supabase
          .from("people")
          .update(includeExtendedColumns ? updatePayload : legacyUpdatePayload)
          .eq("id", personId);
      };
      const firstUpdate = await updateRecord(true);
      const retryUpdate =
        firstUpdate.error && isMissingColumn(firstUpdate.error.message, ["photo_url", "family_phone"])
          ? await updateRecord(false)
          : null;
      const { error } = retryUpdate ?? firstUpdate;

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
              familyPhone: input.familyPhone ? input.familyPhone.replace(/\D/g, "") : person.familyPhone,
              maritalStatus: input.maritalStatus ?? person.maritalStatus,
              privateNotes: input.privateNotes ?? person.privateNotes,
              photoUrl: input.photoUrl ?? person.photoUrl,
            }
          : person,
      ),
    );

    return { ok: true };
  }

  async function deletePerson(personId: string, persistToSupabase?: boolean) {
    if (persistToSupabase) {
      const { error } = await supabase.from("people").delete().eq("id", personId);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setItems((current) => current.filter((person) => person.id !== personId));
    return { ok: true };
  }

  return { people: items, addPerson, updatePeople, updatePerson, deletePerson, refreshPeople, isLoadingPeople, peopleLoadError };
}

export function useCells() {
  const [items, setItems] = useState<Cell[]>([]);
  const [isLoadingCells, setIsLoadingCells] = useState(false);
  const [cellLoadError, setCellLoadError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);

  async function refreshCells() {
    setIsLoadingCells(true);
    setCellLoadError("");

    const cellsRpcResult = await supabase.rpc("get_my_cells");
    const cellsQuery = cellsRpcResult.error && isMissingRpc(cellsRpcResult.error.message)
      ? supabase
          .from("cells")
          .select("id, church_id, name, leader_id, supervisor_id, meeting_day, meeting_time, address, neighborhood, active")
      : Promise.resolve(cellsRpcResult);

    const profilesRpcResult = await supabase.rpc("get_my_profiles");
    const profilesQuery = profilesRpcResult.error && isMissingRpc(profilesRpcResult.error.message)
      ? supabase.from("profiles").select("id, name")
      : Promise.resolve(profilesRpcResult);

    const [{ data, error }, profilesResult] = await Promise.all([
      cellsQuery,
      profilesQuery,
    ]);

    setIsLoadingCells(false);

    if (error) {
      setCellLoadError(error.message);
      return { ok: false, error: error.message };
    }

    const profileNames = new Map(((profilesResult.data ?? []) as { id: string; name: string }[]).map((profile) => [profile.id, profile.name]));
    const cellRows = (data ?? []) as Parameters<typeof mapSupabaseCell>[0][];
    setItems(cellRows.map((cell) => mapSupabaseCell(cell, profileNames.get(cell.leader_id ?? "") ?? "Sem lider")));
    return { ok: true, cells: cellRows };
  }

  useEffect(() => {
    queueMicrotask(() => {
      refreshCells();
    });
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
      const rpcResult = await supabase
        .rpc("create_cell_secure", {
          cell_name: input.name,
          cell_leader_id: input.leaderUserId || null,
          cell_supervisor_id: input.supervisorUserId || null,
          cell_meeting_day: input.meetingDay || null,
          cell_meeting_time: input.meetingTime || null,
          cell_address: input.address || null,
          cell_neighborhood: input.neighborhood || null,
        })
        .single();

      const { data, error } = rpcResult.error && isMissingRpc(rpcResult.error.message)
        ? await supabase
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
            .single()
        : rpcResult;

      if (error) {
        return { ok: false, error: error.message };
      }

      const createdCell = data as { id?: string } | null;
      if (createdCell?.id) {
        localCell.id = createdCell.id;
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

  async function updateCell(input: {
    id: string;
    name: string;
    leaderUserId: string;
    leaderName?: string;
    supervisorUserId: string;
    meetingDay: string;
    meetingTime: string;
    address: string;
    neighborhood: string;
    persistToSupabase?: boolean;
  }) {
    if (input.persistToSupabase) {
      const { error } = await supabase
        .rpc("update_cell_secure", {
          target_cell_id: input.id,
          cell_name: input.name,
          cell_leader_id: input.leaderUserId || null,
          cell_supervisor_id: input.supervisorUserId || null,
          cell_meeting_day: input.meetingDay || null,
          cell_meeting_time: input.meetingTime || null,
          cell_address: input.address || null,
          cell_neighborhood: input.neighborhood || null,
        })
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setItems((current) =>
      current.map((cell) =>
        cell.id === input.id
          ? {
              ...cell,
              name: input.name,
              leaderUserId: input.leaderUserId,
              leaderName: input.leaderName || cell.leaderName,
              supervisorUserId: input.supervisorUserId,
              meetingDay: input.meetingDay,
              meetingTime: input.meetingTime,
              address: input.address,
              neighborhood: input.neighborhood,
            }
          : cell,
      ),
    );

    return { ok: true };
  }

  async function deleteCell(id: string, persistToSupabase?: boolean) {
    if (persistToSupabase) {
      const { error } = await supabase.rpc("delete_cell_secure", { target_cell_id: id });

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setItems((current) => current.filter((cell) => cell.id !== id));
    return { ok: true };
  }

  return { cells: items, addCell, updateCellAssignment, updateCell, deleteCell, refreshCells, isLoadingCells, cellLoadError };
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
      const rpcResult = await supabase.rpc("get_my_profiles");
      const { data, error } = rpcResult.error && isMissingRpc(rpcResult.error.message)
        ? await supabase
            .from("profiles")
            .select("id, church_id, name, role")
            .order("name", { ascending: true })
        : rpcResult;

      if (!error && data) {
        const profileRows = data as { id: string; church_id: string | null; name: string; role: UserRole }[];
        setProfiles(
          profileRows.map((profile) => ({
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

  async function deleteProfileUser(input: {
    userId: string;
    persistToSupabase?: boolean;
  }) {
    if (input.persistToSupabase) {
      const { error } = await supabase.rpc("delete_user_secure", { target_user_id: input.userId });

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setProfiles((current) => current.filter((profile) => profile.id !== input.userId));
    return { ok: true };
  }

  return { profiles, updateProfileRole, deleteProfileUser };
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
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportLoadError, setReportLoadError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setReports(readJson<CellReport[]>(CELL_REPORTS_KEY, []));
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
      setIsLoadingReports(true);
      setReportLoadError("");
      const reportSelect =
        "id, cell_id, leader_id, supervisor_id, meeting_date, present_count, visitors_count, service_count, decisions_count, highlights, needs, prayer_requests, supervisor_visited, supervisor_visit_notes, created_at";
      const legacyReportSelect =
        "id, cell_id, leader_id, supervisor_id, meeting_date, present_count, visitors_count, service_count, decisions_count, highlights, needs, prayer_requests, created_at";
      const initialReportsResult = await supabase.from("cell_reports").select(reportSelect);
      const reportsResult =
        initialReportsResult.error && isMissingColumn(initialReportsResult.error.message, ["supervisor_visited", "supervisor_visit_notes"])
          ? await supabase.from("cell_reports").select(legacyReportSelect)
          : initialReportsResult;
      const [cellsResult, profilesResult] = await Promise.all([
        supabase.from("cells").select("id, name"),
        supabase.from("profiles").select("id, name"),
      ]);

      setIsLoadingReports(false);

      if (reportsResult.error) {
        setReportLoadError(reportsResult.error.message);
        return;
      }

      if (!reportsResult.error && reportsResult.data) {
        const cellNames = new Map((cellsResult.data ?? []).map((cell) => [cell.id, cell.name]));
        const profileNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.name]));
        const reportRows = (reportsResult.data ?? []) as Array<{
          id: string;
          cell_id: string;
          leader_id?: string | null;
          supervisor_id?: string | null;
          meeting_date: string;
          present_count: number;
          visitors_count: number;
          service_count: number;
          decisions_count: number;
          highlights?: string | null;
          needs?: string | null;
          prayer_requests?: string | null;
          supervisor_visited?: boolean | null;
          supervisor_visit_notes?: string | null;
          created_at: string;
        }>;
        setReports(
          reportRows.map((report) => ({
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
            supervisorVisited: report.supervisor_visited ?? false,
            supervisorVisitNotes: report.supervisor_visit_notes ?? "",
            createdAt: report.created_at,
          })),
        );
      }
    }

    loadSupabaseReports();
  }, []);

  useOfflineSyncSuccess((detail) => {
    if (detail.type !== "cell-report" || !detail.localId || !detail.syncedId) {
      return;
    }

    setReports((current) =>
      current.map((report) =>
        report.id === detail.localId
          ? {
              ...report,
              id: detail.syncedId ?? report.id,
              createdAt: detail.createdAt ?? report.createdAt,
            }
          : report,
      ),
    );
  });

  async function addReport(
    report: Omit<CellReport, "id" | "createdAt"> & { churchId?: string; persistToSupabase?: boolean },
  ): Promise<{ ok: boolean; report: CellReport; synced: boolean; error?: string }> {
    const localReport: CellReport = {
      ...report,
      id: `report-${report.cellId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setReports((current) => [localReport, ...current]);

    if (!report.persistToSupabase) {
      return { ok: true, report: localReport, synced: false };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOfflineAction({
        type: "cell-report",
        payload: {
          localId: localReport.id,
          churchId: report.churchId,
          cellId: report.cellId,
          leaderUserId: report.leaderUserId,
          supervisorUserId: report.supervisorUserId,
          meetingDate: toIsoDate(report.meetingDate),
          presentCount: report.presentCount,
          visitorsCount: report.visitorsCount,
          serviceCount: report.serviceCount,
          decisionsCount: report.decisionsCount,
          highlights: report.highlights,
          needs: report.needs,
          prayerRequests: report.prayerRequests,
          supervisorVisited: report.supervisorVisited,
          supervisorVisitNotes: report.supervisorVisitNotes,
        },
      });
      return {
        ok: false,
        report: localReport,
        synced: false,
        error: "Sem internet. O relatorio ficou salvo no aparelho e entrou na fila de sincronizacao.",
      };
    }

    const reportPayload = {
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
      supervisor_visited: report.supervisorVisited ?? false,
      supervisor_visit_notes: report.supervisorVisitNotes || null,
    };
    const legacyReportPayload = { ...reportPayload };
    delete (legacyReportPayload as Partial<typeof reportPayload>).supervisor_visited;
    delete (legacyReportPayload as Partial<typeof reportPayload>).supervisor_visit_notes;

    let { data, error } = await supabase
      .from("cell_reports")
      .insert(reportPayload)
      .select("id, created_at")
      .single();

    if (error && isMissingColumn(error.message, ["supervisor_visited", "supervisor_visit_notes"])) {
      const fallback = await supabase
        .from("cell_reports")
        .insert(legacyReportPayload)
        .select("id, created_at")
        .single();

      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) {
      enqueueOfflineAction({
        type: "cell-report",
        payload: {
          localId: localReport.id,
          churchId: report.churchId,
          cellId: report.cellId,
          leaderUserId: report.leaderUserId,
          supervisorUserId: report.supervisorUserId,
          meetingDate: toIsoDate(report.meetingDate),
          presentCount: report.presentCount,
          visitorsCount: report.visitorsCount,
          serviceCount: report.serviceCount,
          decisionsCount: report.decisionsCount,
          highlights: report.highlights,
          needs: report.needs,
          prayerRequests: report.prayerRequests,
          supervisorVisited: report.supervisorVisited,
          supervisorVisitNotes: report.supervisorVisitNotes,
        },
      });
      return {
        ok: false,
        report: localReport,
        synced: false,
        error: error?.message ?? "Nao foi possivel sincronizar o relatorio agora.",
      };
    }

    const newReport = { ...localReport, id: data.id, createdAt: data.created_at };
    setReports((current) => current.map((item) => (item.id === localReport.id ? newReport : item)));
    return { ok: true, report: newReport, synced: true };
  }

  return { reports, addReport, isLoadingReports, reportLoadError };
}

export function useSupervisorVisits() {
  const [visits, setVisits] = useState<SupervisorVisit[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [visitLoadError, setVisitLoadError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setVisits(readJson<SupervisorVisit[]>(SUPERVISOR_VISITS_KEY, []));
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
      setIsLoadingVisits(true);
      setVisitLoadError("");
      const [visitsResult, cellsResult, profilesResult] = await Promise.all([
        supabase
          .from("supervisor_visits")
          .select("id, church_id, cell_id, supervisor_id, leader_id, visit_date, visit_type, leader_present, health_score, notes, next_steps, created_at"),
        supabase.from("cells").select("id, name"),
        supabase.from("profiles").select("id, name"),
      ]);

      setIsLoadingVisits(false);

      if (visitsResult.error) {
        setVisitLoadError(visitsResult.error.message);
        return;
      }

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

  useOfflineSyncSuccess((detail) => {
    if (detail.type !== "supervisor-visit" || !detail.localId || !detail.syncedId) {
      return;
    }

    setVisits((current) =>
      current.map((visit) =>
        visit.id === detail.localId
          ? {
              ...visit,
              id: detail.syncedId ?? visit.id,
              createdAt: detail.createdAt ?? visit.createdAt,
            }
          : visit,
      ),
    );
  });

  async function addVisit(
    visit: Omit<SupervisorVisit, "id" | "createdAt"> & { persistToSupabase?: boolean },
  ): Promise<{ ok: boolean; visit: SupervisorVisit; synced: boolean; error?: string }> {
    const localVisit: SupervisorVisit = {
      ...visit,
      id: `visit-${visit.cellId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setVisits((current) => [localVisit, ...current]);

    if (!visit.persistToSupabase) {
      return { ok: true, visit: localVisit, synced: false };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOfflineAction({
        type: "supervisor-visit",
        payload: {
          localId: localVisit.id,
          churchId: visit.churchId,
          cellId: visit.cellId,
          supervisorUserId: visit.supervisorUserId,
          leaderUserId: visit.leaderUserId,
          visitDate: toIsoDate(visit.visitDate),
          visitType: visit.visitType,
          leaderPresent: visit.leaderPresent,
          healthScore: visit.healthScore,
          notes: visit.notes,
          nextSteps: visit.nextSteps,
        },
      });
      return {
        ok: false,
        visit: localVisit,
        synced: false,
        error: "Sem internet. A supervisao ficou salva no aparelho e entrou na fila de sincronizacao.",
      };
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

    if (error || !data) {
      enqueueOfflineAction({
        type: "supervisor-visit",
        payload: {
          localId: localVisit.id,
          churchId: visit.churchId,
          cellId: visit.cellId,
          supervisorUserId: visit.supervisorUserId,
          leaderUserId: visit.leaderUserId,
          visitDate: toIsoDate(visit.visitDate),
          visitType: visit.visitType,
          leaderPresent: visit.leaderPresent,
          healthScore: visit.healthScore,
          notes: visit.notes,
          nextSteps: visit.nextSteps,
        },
      });
      return {
        ok: false,
        visit: localVisit,
        synced: false,
        error: error?.message ?? "Nao foi possivel sincronizar a supervisao agora.",
      };
    }

    const newVisit = { ...localVisit, id: data.id, createdAt: data.created_at };
    setVisits((current) => current.map((item) => (item.id === localVisit.id ? newVisit : item)));
    return { ok: true, visit: newVisit, synced: true };
  }

  return { visits, addVisit, isLoadingVisits, visitLoadError };
}

export function useActivityEvents() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventLoadError, setEventLoadError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setEvents(readJson<ActivityEvent[]>(ACTIVITY_EVENTS_KEY, []));
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
      setIsLoadingEvents(true);
      setEventLoadError("");
      const { data, error } = await supabase
        .from("activity_events")
        .select("id, church_id, actor_user_id, actor_name, actor_role, action, description, target_type, target_id, target_name, cell_id, person_id, visibility, created_at");

      setIsLoadingEvents(false);

      if (error) {
        setEventLoadError(error.message);
        return;
      }

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

  useOfflineSyncSuccess((detail) => {
    if (detail.type !== "activity-event" || !detail.localId || !detail.syncedId) {
      return;
    }

    setEvents((current) =>
      current.map((event) =>
        event.id === detail.localId
          ? {
              ...event,
              id: detail.syncedId ?? event.id,
              createdAt: detail.createdAt ?? event.createdAt,
            }
          : event,
      ),
    );
  });

  async function addEvent(
    event: Omit<ActivityEvent, "id" | "createdAt"> & { persistToSupabase?: boolean },
  ): Promise<{ ok: boolean; event: ActivityEvent; synced: boolean; error?: string }> {
    const localEvent: ActivityEvent = {
      ...event,
      id: `activity-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setEvents((current) => [localEvent, ...current]);

    if (!event.persistToSupabase) {
      return { ok: true, event: localEvent, synced: false };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOfflineAction({
        type: "activity-event",
        payload: {
          localId: localEvent.id,
          churchId: event.churchId,
          actorUserId: event.actorUserId,
          actorName: event.actorName,
          actorRole: event.actorRole,
          action: event.action,
          description: event.description,
          targetType: event.targetType,
          targetId: event.targetId,
          targetName: event.targetName,
          cellId: event.cellId,
          personId: event.personId,
          visibility: event.visibility,
        },
      });
      return {
        ok: false,
        event: localEvent,
        synced: false,
        error: "Sem internet. A atividade entrou na fila de sincronizacao.",
      };
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

    if (error || !data) {
      enqueueOfflineAction({
        type: "activity-event",
        payload: {
          localId: localEvent.id,
          churchId: event.churchId,
          actorUserId: event.actorUserId,
          actorName: event.actorName,
          actorRole: event.actorRole,
          action: event.action,
          description: event.description,
          targetType: event.targetType,
          targetId: event.targetId,
          targetName: event.targetName,
          cellId: event.cellId,
          personId: event.personId,
          visibility: event.visibility,
        },
      });
      return {
        ok: false,
        event: localEvent,
        synced: false,
        error: error?.message ?? "Nao foi possivel sincronizar a atividade agora.",
      };
    }

    const newEvent = { ...localEvent, id: data.id, createdAt: data.created_at };
    setEvents((current) => current.map((item) => (item.id === localEvent.id ? newEvent : item)));
    return { ok: true, event: newEvent, synced: true };
  }

  return { events, addEvent, isLoadingEvents, eventLoadError };
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

  async function updateTrack(input: {
    id: string;
    title: string;
    description: string;
    persistToSupabase?: boolean;
  }) {
    if (input.persistToSupabase) {
      const { error } = await supabase
        .from("discipleship_tracks")
        .update({
          title: input.title,
          description: input.description || null,
        })
        .eq("id", input.id);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setTracks((current) =>
      current.map((track) =>
        track.id === input.id
          ? {
              ...track,
              title: input.title,
              description: input.description,
            }
          : track,
      ),
    );

    return { ok: true };
  }

  async function deleteTrack(trackId: string, persistToSupabase?: boolean) {
    if (persistToSupabase) {
      const { error } = await supabase.from("discipleship_tracks").delete().eq("id", trackId);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    const removedVideoIds = new Set(videos.filter((video) => video.trackId === trackId).map((video) => video.id));
    setTracks((current) => current.filter((track) => track.id !== trackId));
    setVideos((current) => current.filter((video) => video.trackId !== trackId));
    setAccesses((current) => current.filter((access) => access.trackId !== trackId));
    setProgress((current) => current.filter((item) => !removedVideoIds.has(item.videoId)));
    return { ok: true };
  }

  async function updateVideo(input: {
    id: string;
    title: string;
    description: string;
    videoUrl: string;
    durationSeconds: number;
    persistToSupabase?: boolean;
  }) {
    if (input.persistToSupabase) {
      const { error } = await supabase
        .from("discipleship_videos")
        .update({
          title: input.title,
          description: input.description || null,
          video_url: input.videoUrl,
          duration_seconds: input.durationSeconds,
        })
        .eq("id", input.id);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setVideos((current) =>
      current.map((video) =>
        video.id === input.id
          ? {
              ...video,
              title: input.title,
              description: input.description,
              videoUrl: input.videoUrl,
              durationSeconds: input.durationSeconds,
            }
          : video,
      ),
    );

    return { ok: true };
  }

  async function deleteVideo(videoId: string, persistToSupabase?: boolean) {
    if (persistToSupabase) {
      const { error } = await supabase.from("discipleship_videos").delete().eq("id", videoId);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setVideos((current) => current.filter((video) => video.id !== videoId));
    setProgress((current) => current.filter((item) => item.videoId !== videoId));
    return { ok: true };
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

  return {
    tracks,
    videos,
    accesses,
    progress,
    addTrack,
    addVideo,
    updateTrack,
    deleteTrack,
    updateVideo,
    deleteVideo,
    releaseTrack,
    updateVideoProgress,
  };
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

    const rpcResult = await supabase.rpc("get_my_invites");
    const fallbackInvites = async (includePersonId: boolean) =>
      supabase
        .from("invites")
        .select(
          includePersonId
            ? "id, church_id, token, email, name, role, cell_id, person_id, created_by, status, expires_at, accepted_by, accepted_at, created_at"
            : "id, church_id, token, email, name, role, cell_id, created_by, status, expires_at, accepted_by, accepted_at, created_at",
        )
        .order("created_at", { ascending: false });
    const fallbackResult = rpcResult.error && isMissingRpc(rpcResult.error.message)
      ? await fallbackInvites(true)
      : null;
    const retryFallbackResult = fallbackResult?.error?.message.toLowerCase().includes("person_id")
      ? await fallbackInvites(false)
      : null;
    const { data, error } = retryFallbackResult ?? fallbackResult ?? rpcResult;

    setIsLoadingInvites(false);

    if (error) {
      setInviteLoadError(error.message);
      return { ok: false, error: error.message };
    }

    setInvites(((data ?? []) as Parameters<typeof mapInviteRow>[0][]).map((invite) => mapInviteRow(invite)));
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
    personId?: string;
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
      personId: input.personId,
      createdBy: input.createdBy,
      status: "pending",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      createdAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const rpcResult = input.personId
        ? await supabase
            .rpc("create_invite_for_person", {
              invite_token: localInvite.token,
              invite_email: input.email || null,
              invite_name: input.name || null,
              invite_role: input.role,
              invite_cell_id: input.cellId || null,
              invite_person_id: input.personId,
              invite_expires_at: localInvite.expiresAt,
            })
            .single()
        : await supabase
            .rpc("create_invite_secure", {
              invite_token: localInvite.token,
              invite_email: input.email || null,
              invite_name: input.name || null,
              invite_role: input.role,
              invite_cell_id: input.cellId || null,
              invite_expires_at: localInvite.expiresAt,
            })
            .single();

      const fallbackInsert = async (includePersonId: boolean) =>
        supabase
            .from("invites")
            .insert({
              church_id: input.churchId,
              token: localInvite.token,
              email: input.email || null,
              name: input.name || null,
              role: input.role,
              cell_id: input.cellId || null,
              ...(includePersonId ? { person_id: input.personId || null } : {}),
              created_by: input.createdBy,
              status: "pending",
              expires_at: localInvite.expiresAt,
            })
            .select("id, created_at")
            .single();

      const fallbackResult = rpcResult.error && isMissingRpc(rpcResult.error.message)
        ? await fallbackInsert(Boolean(input.personId))
        : null;
      const retryFallbackResult =
        fallbackResult?.error && input.personId && fallbackResult.error.message.toLowerCase().includes("person_id")
          ? await fallbackInsert(false)
          : null;
      const { data, error } = retryFallbackResult ?? fallbackResult ?? rpcResult;

      if (error) {
        return { ok: false, error: error.message };
      }

      const createdInvite = data as { id?: string; created_at?: string } | null;
      if (createdInvite) {
        localInvite.id = createdInvite.id ?? localInvite.id;
        localInvite.createdAt = createdInvite.created_at ?? localInvite.createdAt;
      }
    }

    setInvites((current) => [localInvite, ...current]);
    return { ok: true, invite: localInvite };
  }

  async function deleteInvite(id: string) {
    const { error } = await supabase.rpc("delete_invite_secure", { target_invite_id: id });

    if (error && !isMissingRpc(error.message)) {
      return { ok: false, error: error.message };
    }

    if (error && isMissingRpc(error.message)) {
      const fallback = await supabase.from("invites").delete().eq("id", id);

      if (fallback.error) {
        return { ok: false, error: fallback.error.message };
      }
    }

    setInvites((current) => current.filter((invite) => invite.id !== id));
    return { ok: true };
  }

  return { invites, createInvite, deleteInvite, refreshInvites, isLoadingInvites, inviteLoadError };
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

  useOfflineSyncSuccess((detail) => {
    if (detail.type !== "pastoral-reminder" || !detail.localId || !detail.syncedId) {
      return;
    }

    setReminders((current) =>
      current.map((reminder) =>
        reminder.id === detail.localId
          ? {
              ...reminder,
              id: detail.syncedId ?? reminder.id,
              createdAt: detail.createdAt ?? reminder.createdAt,
            }
          : reminder,
      ),
    );
  });

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
    setReminders((current) => [localReminder, ...current].sort((a, b) => a.dueAt.localeCompare(b.dueAt)));

    if (!input.persistToSupabase) {
      return { ok: true, reminder: localReminder };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOfflineAction({
        type: "pastoral-reminder",
        payload: {
          localId: localReminder.id,
          churchId: input.churchId,
          assignedTo: input.assignedTo,
          title: input.title,
          description: input.description,
          reminderType: input.reminderType,
          dueAt: input.dueAt,
          personId: input.personId,
          cellId: input.cellId,
          createdBy: input.createdBy,
        },
      });
      return {
        ok: false,
        reminder: localReminder,
        error: "Sem internet. O lembrete entrou na fila de sincronizacao.",
      };
    }

    {
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
        enqueueOfflineAction({
          type: "pastoral-reminder",
          payload: {
            localId: localReminder.id,
            churchId: input.churchId,
            assignedTo: input.assignedTo,
            title: input.title,
            description: input.description,
            reminderType: input.reminderType,
            dueAt: input.dueAt,
            personId: input.personId,
            cellId: input.cellId,
            createdBy: input.createdBy,
          },
        });
        return { ok: false, reminder: localReminder, error: error.message };
      }

      if (data) {
        setReminders((current) =>
          current
            .map((reminder) =>
              reminder.id === localReminder.id
                ? { ...reminder, id: data.id, createdAt: data.created_at }
                : reminder,
            )
            .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
        );
        return { ok: true, reminder: { ...localReminder, id: data.id, createdAt: data.created_at } };
      }
    }

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

  useOfflineSyncSuccess((detail) => {
    if (detail.type !== "prayer-request" || !detail.localId || !detail.syncedId) {
      return;
    }

    setRequests((current) =>
      current.map((request) =>
        request.id === detail.localId
          ? {
              ...request,
              id: detail.syncedId ?? request.id,
              createdAt: detail.createdAt ?? request.createdAt,
            }
          : request,
      ),
    );
  });

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
    setRequests((current) => [localRequest, ...current]);

    if (!input.persistToSupabase) {
      return { ok: true, request: localRequest };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOfflineAction({
        type: "prayer-request",
        payload: {
          localId: localRequest.id,
          churchId: input.churchId,
          personId: input.personId,
          cellId: input.cellId,
          title: input.title,
          request: input.request,
          visibility: input.visibility,
          createdBy: input.createdBy,
          createdByName: input.createdByName,
        },
      });
      return {
        ok: false,
        request: localRequest,
        error: "Sem internet. O pedido ficou salvo no aparelho e entrou na fila de sincronizacao.",
      };
    }

    {
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
        enqueueOfflineAction({
          type: "prayer-request",
          payload: {
            localId: localRequest.id,
            churchId: input.churchId,
            personId: input.personId,
            cellId: input.cellId,
            title: input.title,
            request: input.request,
            visibility: input.visibility,
            createdBy: input.createdBy,
            createdByName: input.createdByName,
          },
        });
        return { ok: false, request: localRequest, error: error.message };
      }

      if (data) {
        setRequests((current) =>
          current.map((request) =>
            request.id === localRequest.id
              ? { ...request, id: data.id, createdAt: data.created_at }
              : request,
          ),
        );
        return { ok: true, request: { ...localRequest, id: data.id, createdAt: data.created_at } };
      }
    }

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

export function useConsolidationReports(churchId: string) {
  const storageKey = `${CONSOLIDATION_REPORTS_KEY}:${churchId || "demo"}`;
  const [reports, setReports] = useState<ConsolidationReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportLoadError, setReportLoadError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setReports(readJson<ConsolidationReport[]>(storageKey, []));
      setHydrated(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) {
      writeJson(storageKey, reports);
    }
  }, [hydrated, reports, storageKey]);

  const refreshReports = useCallback(async () => {
    setIsLoadingReports(true);
    setReportLoadError("");

    const { data, error } = await supabase
      .from("consolidation_reports")
      .select("*, consolidation_visitors(*)")
      .eq("church_id", churchId)
      .order("service_date", { ascending: false });

    setIsLoadingReports(false);

    if (error) {
      setReportLoadError(error.message);
      return { ok: false, error: error.message };
    }

    const mappedReports = ((data ?? []) as Array<{
      id: string;
      church_id: string;
      service_date: string;
      service_title: string;
      preacher_name?: string | null;
      total_attendance: number;
      temple_count?: number | null;
      baby_count?: number | null;
      vagalumes_count?: number | null;
      serving_count: number;
      ministry_counts?: Record<string, number> | null;
      kids_count?: number | null;
      tithe_count?: number | null;
      offering_count?: number | null;
      tithe_names?: string | null;
      offering_names?: string | null;
      visitors_count: number;
      accepted_jesus_count: number;
      baptism_decision_count: number;
      notes: string | null;
      created_by: string | null;
      created_by_name: string | null;
      created_at: string;
      consolidation_visitors?: Array<{
        id: string;
        name: string;
        phone: string;
        email: string | null;
        age?: number | null;
        address: string | null;
        neighborhood: string | null;
        decision: ConsolidationVisitor["decision"];
        notes: string | null;
        suggested_cell_id: string | null;
        suggested_cell_name: string | null;
        person_id: string | null;
      }>;
    }>).map((report) => ({
      id: report.id,
      churchId: report.church_id,
      serviceDate: report.service_date,
      serviceTitle: report.service_title,
      preacherName: report.preacher_name ?? "",
      totalAttendance: report.total_attendance,
      templeCount: report.temple_count ?? report.total_attendance,
      babyCount: report.baby_count ?? 0,
      vagalumesCount: report.vagalumes_count ?? 0,
      servingCount: report.serving_count,
      ministryCounts: report.ministry_counts ?? {},
      kidsCount: report.kids_count ?? 0,
      titheCount: report.tithe_count ?? 0,
      offeringCount: report.offering_count ?? 0,
      titheNames: report.tithe_names ?? "",
      offeringNames: report.offering_names ?? "",
      visitorsCount: report.visitors_count,
      acceptedJesusCount: report.accepted_jesus_count,
      baptismDecisionCount: report.baptism_decision_count,
      notes: report.notes ?? "",
      createdBy: report.created_by ?? "",
      createdByName: report.created_by_name ?? "Consolidacao",
      createdAt: report.created_at,
      visitors: (report.consolidation_visitors ?? []).map((visitor) => ({
        id: visitor.id,
        name: visitor.name,
        phone: visitor.phone,
        email: visitor.email ?? undefined,
        age: visitor.age ?? undefined,
        address: visitor.address ?? undefined,
        neighborhood: visitor.neighborhood ?? undefined,
        decision: visitor.decision,
        notes: visitor.notes ?? undefined,
        suggestedCellId: visitor.suggested_cell_id ?? undefined,
        suggestedCellName: visitor.suggested_cell_name ?? undefined,
        personId: visitor.person_id ?? undefined,
      })),
    }));

    setReports(mappedReports);
    return { ok: true, reports: mappedReports };
  }, [churchId]);

  useEffect(() => {
    if (churchId) {
      queueMicrotask(() => {
        refreshReports();
      });
    }
  }, [churchId, refreshReports]);

  async function addReport(
    input: Omit<ConsolidationReport, "id" | "createdAt"> & { persistToSupabase?: boolean },
  ): Promise<{ ok: boolean; report?: ConsolidationReport; error?: string }> {
    const localReport: ConsolidationReport = {
      ...input,
      id: `consolidacao-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (input.persistToSupabase) {
      const reportPayload = {
        church_id: input.churchId,
        service_date: input.serviceDate,
        service_title: input.serviceTitle,
        preacher_name: input.preacherName || null,
        total_attendance: input.totalAttendance,
        temple_count: input.templeCount ?? input.totalAttendance,
        baby_count: input.babyCount ?? 0,
        vagalumes_count: input.vagalumesCount ?? 0,
        serving_count: input.servingCount,
        ministry_counts: input.ministryCounts ?? {},
        kids_count: input.kidsCount ?? 0,
        tithe_count: input.titheCount ?? 0,
        offering_count: input.offeringCount ?? 0,
        tithe_names: input.titheNames || null,
        offering_names: input.offeringNames || null,
        visitors_count: input.visitorsCount,
        accepted_jesus_count: input.acceptedJesusCount,
        baptism_decision_count: input.baptismDecisionCount,
        notes: input.notes || null,
        created_by: input.createdBy,
        created_by_name: input.createdByName,
      };

      let { data, error } = await supabase
        .from("consolidation_reports")
        .insert(reportPayload)
        .select("id, created_at")
        .single();

      if (error && (error.message.includes("ministry_counts") || error.message.includes("kids_count") || error.message.includes("temple_count") || error.message.includes("baby_count") || error.message.includes("vagalumes_count") || error.message.includes("preacher_name") || error.message.includes("tithe_count") || error.message.includes("offering_count") || error.message.includes("tithe_names") || error.message.includes("offering_names"))) {
        const fallbackPayload = { ...reportPayload };
        delete (fallbackPayload as Partial<typeof reportPayload>).ministry_counts;
        delete (fallbackPayload as Partial<typeof reportPayload>).kids_count;
        delete (fallbackPayload as Partial<typeof reportPayload>).temple_count;
        delete (fallbackPayload as Partial<typeof reportPayload>).baby_count;
        delete (fallbackPayload as Partial<typeof reportPayload>).vagalumes_count;
        delete (fallbackPayload as Partial<typeof reportPayload>).preacher_name;
        delete (fallbackPayload as Partial<typeof reportPayload>).tithe_count;
        delete (fallbackPayload as Partial<typeof reportPayload>).offering_count;
        delete (fallbackPayload as Partial<typeof reportPayload>).tithe_names;
        delete (fallbackPayload as Partial<typeof reportPayload>).offering_names;

        const fallback = await supabase
          .from("consolidation_reports")
          .insert(fallbackPayload)
          .select("id, created_at")
          .single();

        data = fallback.data;
        error = fallback.error;
      }

      if (error || !data) {
        return { ok: false, error: error?.message ?? "Nao foi possivel salvar a consolidacao." };
      }

      localReport.id = data.id;
      localReport.createdAt = data.created_at;

      if (input.visitors.length > 0) {
        const visitorPayload = input.visitors.map((visitor) => ({
          report_id: localReport.id,
          church_id: input.churchId,
          name: visitor.name,
          phone: visitor.phone.replace(/\D/g, ""),
          email: visitor.email || null,
          age: visitor.age ?? null,
          address: visitor.address || null,
          neighborhood: visitor.neighborhood || null,
          decision: visitor.decision,
          notes: visitor.notes || null,
          suggested_cell_id: visitor.suggestedCellId || null,
          suggested_cell_name: visitor.suggestedCellName || null,
          person_id: visitor.personId || null,
        }));

        let { data: visitorRows, error: visitorsError } = await supabase
          .from("consolidation_visitors")
          .insert(visitorPayload)
          .select("id");

        if (visitorsError && visitorsError.message.includes("age")) {
          const fallbackVisitors = await supabase
            .from("consolidation_visitors")
            .insert(
              visitorPayload.map((visitor) => {
                const fallbackVisitor = { ...visitor };
                delete (fallbackVisitor as { age?: number | null }).age;
                return fallbackVisitor;
              }),
            )
            .select("id");

          visitorRows = fallbackVisitors.data;
          visitorsError = fallbackVisitors.error;
        }

        if (visitorsError) {
          return { ok: false, error: visitorsError.message };
        }

        localReport.visitors = localReport.visitors.map((visitor, index) => ({
          ...visitor,
          id: visitorRows?.[index]?.id ?? visitor.id,
        }));
      }
    }

    setReports((current) => [localReport, ...current]);
    return { ok: true, report: localReport };
  }

  async function deleteReport(reportId: string, persistToSupabase?: boolean) {
    if (persistToSupabase) {
      const { error } = await supabase.from("consolidation_reports").delete().eq("id", reportId);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setReports((current) => current.filter((report) => report.id !== reportId));
    return { ok: true };
  }

  async function updateVisitor(
    visitorId: string,
    input: Partial<ConsolidationVisitor> & { persistToSupabase?: boolean },
  ) {
    if (input.persistToSupabase) {
      const visitorPayload = {
        name: input.name,
        phone: input.phone?.replace(/\D/g, ""),
        email: input.email || null,
        age: input.age ?? null,
        address: input.address || null,
        neighborhood: input.neighborhood || null,
        decision: input.decision,
        notes: input.notes || null,
        suggested_cell_id: input.suggestedCellId || null,
        suggested_cell_name: input.suggestedCellName || null,
        person_id: input.personId || null,
      };
      const legacyPayload = {
        name: input.name,
        phone: input.phone?.replace(/\D/g, ""),
        email: input.email || null,
        address: input.address || null,
        neighborhood: input.neighborhood || null,
        decision: input.decision,
        notes: input.notes || null,
        suggested_cell_id: input.suggestedCellId || null,
        suggested_cell_name: input.suggestedCellName || null,
        person_id: input.personId || null,
      };

      const firstUpdate = await supabase
        .from("consolidation_visitors")
        .update(visitorPayload)
        .eq("id", visitorId);
      const retryUpdate =
        firstUpdate.error && isMissingColumn(firstUpdate.error.message, ["age"])
          ? await supabase.from("consolidation_visitors").update(legacyPayload).eq("id", visitorId)
          : null;
      const { error } = retryUpdate ?? firstUpdate;

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    setReports((current) =>
      current.map((report) => ({
        ...report,
        visitors: report.visitors.map((visitor) =>
          visitor.id === visitorId
            ? {
                ...visitor,
                ...input,
                phone: input.phone ? input.phone.replace(/\D/g, "") : visitor.phone,
              }
            : visitor,
        ),
      })),
    );

    return { ok: true };
  }

  return { reports, addReport, deleteReport, updateVisitor, refreshReports, isLoadingReports, reportLoadError };
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

  const { error: attendanceError } = input.records.length
    ? await supabase.from("cell_attendance").insert(
        input.records.map((record) => ({
          meeting_id: meeting.id,
          person_id: record.personId,
          present: record.present,
          notes: record.notes || null,
        })),
      )
    : { error: null };

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

  const { error: attendanceError } = input.records.length
    ? await supabase.from("service_attendance").insert(
        input.records.map((record) => ({
          service_id: service.id,
          person_id: record.personId,
          present: record.present,
        })),
      )
    : { error: null };

  if (attendanceError) {
    enqueueOfflineAction({ type: "service-attendance", payload: input });
    return { ok: false, error: attendanceError.message };
  }

  return { ok: true, serviceId: service.id as string };
}

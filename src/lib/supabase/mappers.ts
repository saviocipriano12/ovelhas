import type { Cell, Person } from "@/lib/data";

type SupabaseCell = {
  id: string;
  church_id: string;
  name: string;
  leader_id: string | null;
  supervisor_id: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  address: string | null;
  neighborhood: string | null;
  active: boolean;
};

type SupabasePerson = {
  id: string;
  church_id: string;
  cell_id: string | null;
  person_user_id: string | null;
  created_by_user_id: string | null;
  leader_user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  neighborhood: string | null;
  status: string;
  journey_stage: string;
  first_visit_date: string | null;
  birth_date?: string | null;
  address?: string | null;
  notes?: string | null;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function mapSupabaseCell(cell: SupabaseCell, leaderName = "Sem lider"): Cell {
  return {
    id: cell.id,
    churchId: cell.church_id,
    name: cell.name,
    leaderUserId: cell.leader_id ?? "",
    leaderName,
    supervisorUserId: cell.supervisor_id ?? "",
    neighborhood: cell.neighborhood ?? "",
    meetingDay: cell.meeting_day ?? "",
    meetingTime: cell.meeting_time ?? "",
    address: cell.address ?? "",
    active: cell.active,
  };
}

export function mapSupabasePerson(
  person: SupabasePerson,
  options: {
    cellName?: string;
    leaderName?: string;
    progress?: number;
    cellAbsences?: number;
    servicePresent?: boolean;
  } = {},
): Person {
  return {
    id: person.id,
    name: person.name,
    initials: initials(person.name) || "MB",
    stage: person.journey_stage,
    status: person.status,
    phone: person.phone ?? "",
    email: person.email ?? "",
    cell: options.cellName ?? "Sem celula",
    leader: options.leaderName ?? "Sem lider",
    discipleshipLeader: options.leaderName ?? "Sem lider",
    neighborhood: person.neighborhood ?? "",
    firstVisit: person.first_visit_date ?? "--/--",
    birthDate: person.birth_date ?? "",
    address: person.address ?? "",
    privateNotes: person.notes ?? "",
    birthday: "--/--",
    progress: options.progress ?? 0,
    cellAbsences: options.cellAbsences ?? 0,
    servicePresent: options.servicePresent ?? false,
    tone: "bg-emerald-100 text-emerald-800",
    churchId: person.church_id,
    cellId: person.cell_id ?? "",
    createdByUserId: person.created_by_user_id ?? "",
    leaderUserId: person.leader_user_id ?? "",
    personUserId: person.person_user_id ?? undefined,
  };
}

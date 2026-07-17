import type { Cell, PeaceHouse, PeacePair, Person } from "@/lib/data";

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
  photo_url?: string | null;
  family_phone?: string | null;
  notes?: string | null;
};

type SupabasePeacePair = {
  id: string;
  church_id: string;
  cell_id: string;
  name: string;
  phone: string | null;
  has_house: boolean;
  house_id: string | null;
  created_by: string | null;
  created_at: string;
};

type SupabasePeaceHouse = {
  id: string;
  church_id: string;
  cell_id: string | null;
  full_name: string;
  age: number | null;
  sex: string | null;
  phone: string | null;
  address: string;
  house_number: string | null;
  neighborhood: string | null;
  city: string | null;
  has_pair: boolean;
  pair_id: string | null;
  status: string | null;
  promoted_cell_id: string | null;
  created_by: string | null;
  created_at: string;
};

export function birthdayFromDate(birthDate: string | null | undefined) {
  if (!birthDate) {
    return "--/--";
  }

  const [, month, day] = birthDate.split("-");
  if (!month || !day) {
    return "--/--";
  }

  return `${day}/${month}`;
}

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
    photoUrl: person.photo_url ?? "",
    familyPhone: person.family_phone ?? "",
    privateNotes: person.notes ?? "",
    birthday: birthdayFromDate(person.birth_date),
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

export function mapSupabasePeacePair(pair: SupabasePeacePair): PeacePair {
  return {
    id: pair.id,
    churchId: pair.church_id,
    cellId: pair.cell_id,
    name: pair.name,
    phone: pair.phone ?? "",
    hasHouse: pair.has_house,
    houseId: pair.house_id ?? undefined,
    createdBy: pair.created_by ?? "",
    createdAt: pair.created_at,
  };
}

export function mapSupabasePeaceHouse(house: SupabasePeaceHouse): PeaceHouse {
  return {
    id: house.id,
    churchId: house.church_id,
    cellId: house.cell_id ?? undefined,
    fullName: house.full_name,
    age: house.age ?? undefined,
    sex: house.sex === "feminino" || house.sex === "masculino" ? house.sex : undefined,
    phone: house.phone ?? "",
    address: house.address,
    houseNumber: house.house_number ?? "",
    neighborhood: house.neighborhood ?? "",
    city: house.city ?? "",
    hasPair: house.has_pair,
    pairId: house.pair_id ?? undefined,
    status: house.status === "pronta_para_celula" || house.status === "virou_celula" ? house.status : "em_acompanhamento",
    promotedCellId: house.promoted_cell_id ?? undefined,
    createdBy: house.created_by ?? "",
    createdAt: house.created_at,
  };
}

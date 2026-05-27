import type {
  ActivityEvent,
  AppUser,
  CareTask,
  Cell,
  PastoralNote,
  PastoralReminder,
  Person,
  PrayerRequest,
  SupervisorVisit,
  UserRole,
} from "@/lib/data";

const roleRoutes: Record<UserRole, string[]> = {
  admin: ["*"],
  pastor: [
    "/dashboard",
    "/celulas",
    "/celulas/hoje",
    "/pessoas",
    "/presenca",
    "/checkin",
    "/agenda",
    "/cuidados",
    "/oracao",
    "/biblioteca",
    "/notificacoes",
    "/convites",
    "/supervisao",
    "/gestao",
    "/atividades",
    "/relatorios",
    "/relatorios/novo",
    "/videos",
    "/configuracoes",
    "/instalar",
    "/mais",
  ],
  supervisor: [
    "/dashboard",
    "/celulas",
    "/celulas/hoje",
    "/pessoas",
    "/agenda",
    "/cuidados",
    "/presenca",
    "/checkin",
    "/oracao",
    "/biblioteca",
    "/notificacoes",
    "/convites",
    "/supervisao",
    "/atividades",
    "/relatorios",
    "/relatorios/novo",
    "/videos",
    "/instalar",
    "/mais",
  ],
  leader: [
    "/dashboard",
    "/celulas",
    "/celulas/hoje",
    "/pessoas",
    "/presenca",
    "/checkin",
    "/agenda",
    "/cuidados",
    "/oracao",
    "/biblioteca",
    "/notificacoes",
    "/convites",
    "/relatorios",
    "/relatorios/novo",
    "/videos",
    "/instalar",
    "/mais",
  ],
  consolidation: [
    "/dashboard",
    "/consolidacao",
    "/pessoas",
    "/agenda",
    "/cuidados",
    "/oracao",
    "/biblioteca",
    "/notificacoes",
    "/instalar",
    "/mais",
  ],
  member: ["/meu-discipulado", "/oracao", "/biblioteca", "/notificacoes", "/instalar", "/mais"],
};

export function isPendingAccount(user: AppUser) {
  return user.churchId === "sem-igreja" || (user.role === "member" && !user.personId);
}

export function getDefaultRoute(user: AppUser) {
  if (isPendingAccount(user)) {
    return "/aguardando";
  }

  if (user.role === "consolidation") {
    return "/consolidacao";
  }

  if (user.role === "member") {
    return "/meu-discipulado";
  }

  return "/dashboard";
}

export function canAccessRoute(user: AppUser, pathname: string) {
  if (pathname === "/aguardando") {
    return isPendingAccount(user);
  }

  if (pathname === "/configuracao") {
    return user.role === "admin" || isPendingAccount(user);
  }

  if (isPendingAccount(user)) {
    return false;
  }

  if (pathname === "/") {
    return true;
  }

  const allowedRoutes = roleRoutes[user.role];
  if (allowedRoutes.includes("*")) {
    return true;
  }

  return allowedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function canManagePeople(user: AppUser) {
  return (
    user.role === "admin" ||
    user.role === "pastor" ||
    user.role === "supervisor" ||
    user.role === "leader" ||
    user.role === "consolidation"
  );
}

export function canCreateCell(user: AppUser) {
  return user.role === "admin" || user.role === "pastor" || user.role === "supervisor";
}

export function canAssignCellResponsibility(user: AppUser) {
  return user.role === "admin" || user.role === "pastor" || user.role === "supervisor";
}

export function getInviteableRoles(user: AppUser): UserRole[] {
  if (user.role === "admin") {
    return ["admin", "pastor", "supervisor", "leader", "consolidation", "member"];
  }

  if (user.role === "pastor") {
    return ["supervisor", "leader", "consolidation", "member"];
  }

  if (user.role === "supervisor") {
    return ["leader", "member"];
  }

  if (user.role === "leader") {
    return ["member"];
  }

  return [];
}

export function canViewPerson(user: AppUser, person: Person) {
  if (user.role === "admin") {
    return user.churchId === person.churchId;
  }

  if (user.role === "pastor") {
    return user.churchId === person.churchId;
  }

  if (user.role === "supervisor") {
    return user.churchId === person.churchId && Boolean(user.cellIds?.includes(person.cellId));
  }

  if (user.role === "leader") {
    return person.leaderUserId === user.id || person.createdByUserId === user.id || user.cellIds?.includes(person.cellId);
  }

  if (user.role === "consolidation") {
    return user.churchId === person.churchId && person.createdByUserId === user.id;
  }

  return person.personUserId === user.id || person.id === user.personId;
}

export function getVisiblePeople(user: AppUser, people: Person[]) {
  return people.filter((person) => canViewPerson(user, person));
}

export function getScopedPeople(user: AppUser, people: Person[], isDemoMode: boolean) {
  void isDemoMode;
  return getVisiblePeople(user, people);
}

export function canViewCell(user: AppUser, cell: Cell) {
  if (user.role === "admin" || user.role === "pastor") {
    return user.churchId === cell.churchId;
  }

  if (user.role === "supervisor") {
    return user.churchId === cell.churchId && (cell.supervisorUserId === user.id || Boolean(user.cellIds?.includes(cell.id)));
  }

  if (user.role === "leader") {
    return cell.leaderUserId === user.id || Boolean(user.cellIds?.includes(cell.id));
  }

  if (user.role === "consolidation") {
    return user.churchId === cell.churchId;
  }

  return false;
}

export function getVisibleCells(user: AppUser, cells: Cell[]) {
  return cells.filter((cell) => canViewCell(user, cell));
}

export function getScopedCells(user: AppUser, cells: Cell[], isDemoMode: boolean) {
  void isDemoMode;
  return getVisibleCells(user, cells);
}

export function getVisibleCareTasks(user: AppUser, tasks: CareTask[], people: Person[]) {
  const visiblePersonIds = new Set(getVisiblePeople(user, people).map((person) => person.id));
  return tasks.filter((task) => visiblePersonIds.has(task.personId));
}

export function getScopedCareTasks(user: AppUser, tasks: CareTask[], people: Person[], isDemoMode: boolean) {
  const visiblePersonIds = new Set(getScopedPeople(user, people, isDemoMode).map((person) => person.id));
  return tasks.filter((task) => visiblePersonIds.has(task.personId));
}

export function getVisibleSupervisorVisits(user: AppUser, visits: SupervisorVisit[], cells: Cell[]) {
  const visibleCellIds = new Set(getVisibleCells(user, cells).map((cell) => cell.id));

  if (user.role === "member") {
    return [];
  }

  if (user.role === "consolidation") {
    return [];
  }

  return visits.filter((visit) => {
    if (user.role === "admin" || user.role === "pastor") {
      return visit.churchId === user.churchId;
    }

    if (user.role === "supervisor") {
      return visit.supervisorUserId === user.id || visibleCellIds.has(visit.cellId);
    }

    return visit.leaderUserId === user.id || visibleCellIds.has(visit.cellId);
  });
}

export function getScopedSupervisorVisits(
  user: AppUser,
  visits: SupervisorVisit[],
  cells: Cell[],
  isDemoMode: boolean,
) {
  void isDemoMode;
  return getVisibleSupervisorVisits(user, visits, cells);
}

export function getVisibleActivityEvents(user: AppUser, events: ActivityEvent[], cells: Cell[], people: Person[]) {
  const visibleCellIds = new Set(getVisibleCells(user, cells).map((cell) => cell.id));
  const visiblePersonIds = new Set(getVisiblePeople(user, people).map((person) => person.id));

  return events.filter((event) => {
    if (user.role === "admin" || user.role === "pastor") {
      return event.churchId === user.churchId && event.visibility !== "member";
    }

    if (user.role === "supervisor") {
      return (
        event.actorUserId === user.id ||
        Boolean(event.cellId && visibleCellIds.has(event.cellId)) ||
        Boolean(event.personId && visiblePersonIds.has(event.personId))
      );
    }

    if (user.role === "leader") {
      return (
        event.actorUserId === user.id ||
        Boolean(event.cellId && visibleCellIds.has(event.cellId)) ||
        Boolean(event.personId && visiblePersonIds.has(event.personId))
      );
    }

    if (user.role === "consolidation") {
      return event.actorUserId === user.id || (event.churchId === user.churchId && event.targetType === "person");
    }

    return event.visibility === "member" && event.actorUserId === user.id;
  });
}

export function getScopedActivityEvents(
  user: AppUser,
  events: ActivityEvent[],
  cells: Cell[],
  people: Person[],
  isDemoMode: boolean,
) {
  void isDemoMode;
  return getVisibleActivityEvents(user, events, cells, people);
}

export function canViewPastoralNote(user: AppUser, note: PastoralNote, person: Person) {
  if (!canViewPerson(user, person)) {
    return false;
  }

  if (note.visibility === "member_visible") {
    return true;
  }

  if (note.visibility === "pastor_private") {
    return user.role === "admin" || user.role === "pastor";
  }

  return (
    user.role === "admin" ||
    user.role === "pastor" ||
    user.role === "supervisor" ||
    user.role === "leader" ||
    user.role === "consolidation"
  );
}

export function canWritePastoralNote(user: AppUser, person: Person) {
  return (
    canViewPerson(user, person) &&
    (user.role === "admin" ||
      user.role === "pastor" ||
      user.role === "supervisor" ||
      user.role === "leader" ||
      user.role === "consolidation")
  );
}

export function canViewPastoralReminder(user: AppUser, reminder: PastoralReminder, cells: Cell[], people: Person[]) {
  if (user.role === "admin" || user.role === "pastor") {
    return user.churchId === reminder.churchId;
  }

  if (reminder.assignedTo === user.id || reminder.createdBy === user.id) {
    return true;
  }

  const relatedCell = cells.find((cell) => cell.id === reminder.cellId);
  if (relatedCell && canViewCell(user, relatedCell)) {
    return true;
  }

  const relatedPerson = people.find((person) => person.id === reminder.personId);
  return Boolean(relatedPerson && canViewPerson(user, relatedPerson));
}

export function getVisiblePastoralReminders(
  user: AppUser,
  reminders: PastoralReminder[],
  cells: Cell[],
  people: Person[],
) {
  return reminders.filter((reminder) => canViewPastoralReminder(user, reminder, cells, people));
}

export function getScopedPastoralReminders(
  user: AppUser,
  reminders: PastoralReminder[],
  cells: Cell[],
  people: Person[],
  isDemoMode: boolean,
) {
  void isDemoMode;
  return getVisiblePastoralReminders(user, reminders, cells, people);
}

export function canViewPrayerRequest(user: AppUser, request: PrayerRequest, cells: Cell[], people: Person[]) {
  const person = people.find((item) => item.id === request.personId);
  const cell = cells.find((item) => item.id === request.cellId);

  if (user.role === "admin" || user.role === "pastor") {
    return user.churchId === request.churchId && request.visibility !== "leader_only";
  }

  if (request.createdBy === user.id || person?.personUserId === user.id) {
    return true;
  }

  if (request.visibility === "pastor_only") {
    return false;
  }

  if (user.role === "supervisor") {
    return Boolean(cell && canViewCell(user, cell) && request.visibility === "leadership");
  }

  if (user.role === "leader") {
    return Boolean(
      person &&
        canViewPerson(user, person) &&
        (request.visibility === "leader_only" || request.visibility === "leadership" || request.visibility === "cell_public"),
    );
  }

  if (user.role === "consolidation") {
    return request.createdBy === user.id;
  }

  return Boolean(person && request.visibility === "cell_public" && user.cellIds?.includes(person.cellId));
}

export function getVisiblePrayerRequests(
  user: AppUser,
  requests: PrayerRequest[],
  cells: Cell[],
  people: Person[],
) {
  return requests.filter((request) => canViewPrayerRequest(user, request, cells, people));
}

export function getScopedPrayerRequests(
  user: AppUser,
  requests: PrayerRequest[],
  cells: Cell[],
  people: Person[],
  isDemoMode: boolean,
) {
  void isDemoMode;
  return getVisiblePrayerRequests(user, requests, cells, people);
}

export function describeAccess(user: AppUser) {
  if (user.role === "admin") {
    return "Ve toda a igreja, usuarios, celulas e configuracoes.";
  }

  if (user.role === "pastor") {
    return "Ve todas as celulas e pessoas da igreja.";
  }

  if (user.role === "supervisor") {
    return "Monitora varias celulas liberadas pelo administrador e acompanha os lideres.";
  }

  if (user.role === "leader") {
    return "Cuida da propria celula, dos membros e do discipulado dessas pessoas.";
  }

  if (user.role === "consolidation") {
    return "Registra cultos, visitantes, decisoes e encaminhamentos para celulas.";
  }

  return "Ve apenas seu proprio discipulado e informacoes pessoais.";
}

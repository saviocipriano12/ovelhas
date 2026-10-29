import type {
  ActivityEvent,
  AppUser,
  CareTask,
  Cell,
  PastoralNote,
  PastoralReminder,
  PeaceHouse,
  PeacePair,
  Person,
  PrayerRequest,
  SupervisorVisit,
  UserRole,
} from "@/lib/data";

const roleRoutes: Record<UserRole, string[]> = {
  admin: ["*"],
  pastor: [
    "/dashboard",
    "/consolidacao",
    "/consolidacao/contatos",
    "/perfil",
    "/celulas",
    "/pessoas",
    "/presenca",
    "/checkin",
    "/agenda",
    "/cuidados",
    "/lar-de-paz",
    "/oracao",
    "/biblioteca",
    "/notificacoes",
    "/convites",
    "/supervisao",
    "/gestao",
    "/atividades",
    "/relatorios",
    "/relatorios/novo",
    "/relatorios/tendencias",
    "/videos",
    "/configuracoes",
    "/instalar",
    "/mais",
  ],
  supervisor: [
    "/dashboard",
    "/perfil",
    "/celulas",
    "/pessoas",
    "/agenda",
    "/cuidados",
    "/lar-de-paz",
    "/presenca",
    "/checkin",
    "/oracao",
    "/biblioteca",
    "/notificacoes",
    "/convites",
    "/supervisao",
    "/gestao",
    "/atividades",
    "/relatorios",
    "/relatorios/novo",
    "/relatorios/tendencias",
    "/videos",
    "/instalar",
    "/mais",
  ],
  leader: [
    "/dashboard",
    "/perfil",
    "/celulas",
    "/pessoas",
    "/presenca",
    "/checkin",
    "/agenda",
    "/cuidados",
    "/lar-de-paz",
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
    "/consolidacao",
    "/consolidacao/contatos",
    "/perfil",
    "/instalar",
  ],
  communication: ["/dashboard", "/perfil", "/notificacoes", "/instalar", "/mais"],
  member: ["/meu-discipulado", "/perfil", "/oracao", "/biblioteca", "/notificacoes", "/instalar", "/mais"],
};

export function hasRole(user: AppUser, role: UserRole) {
  return user.role === role || Boolean(user.additionalRoles?.includes(role));
}

function hasAnyRole(user: AppUser, roles: UserRole[]) {
  return roles.some((role) => hasRole(user, role));
}

export function isPendingAccount(user: AppUser) {
  if (user.platformAdmin) {
    return false;
  }

  const hasOperationalRole = hasAnyRole(user, ["admin", "pastor", "supervisor", "leader", "consolidation", "communication"]);
  return user.churchId === "sem-igreja" || (!hasOperationalRole && hasRole(user, "member") && !user.personId);
}

export function getDefaultRoute(user: AppUser) {
  if (isPendingAccount(user)) {
    return "/aguardando";
  }

  if (user.platformAdmin && user.churchId === "sem-igreja") {
    return "/plataforma";
  }

  if (hasAnyRole(user, ["admin", "pastor", "supervisor", "leader"])) {
    return "/dashboard";
  }

  if (hasRole(user, "consolidation")) {
    return "/consolidacao";
  }

  if (hasRole(user, "communication")) {
    return "/notificacoes";
  }

  if (hasRole(user, "member")) {
    return "/meu-discipulado";
  }

  return "/dashboard";
}

export function canAccessRoute(user: AppUser, pathname: string) {
  if (pathname === "/aguardando") {
    return isPendingAccount(user);
  }

  if (pathname === "/configuracao") {
    return hasRole(user, "admin") || isPendingAccount(user);
  }

  if (pathname === "/plataforma" || pathname.startsWith("/plataforma/")) {
    return Boolean(user.platformAdmin) || (hasRole(user, "admin") && user.churchId !== "sem-igreja");
  }

  if (isPendingAccount(user)) {
    return false;
  }

  if (pathname === "/") {
    return true;
  }

  if (pathname === "/assinatura") {
    return true;
  }

  const allowedRoutes = [user.role, ...(user.additionalRoles ?? [])].flatMap((role) => roleRoutes[role]);
  if (allowedRoutes.includes("*")) {
    return true;
  }

  return allowedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function canManagePeople(user: AppUser) {
  return hasAnyRole(user, ["admin", "pastor", "supervisor", "leader"]);
}

export function canCreateCell(user: AppUser) {
  return hasAnyRole(user, ["admin", "pastor", "supervisor"]);
}

export function canAssignCellResponsibility(user: AppUser) {
  return hasAnyRole(user, ["admin", "pastor", "supervisor"]);
}

export function getInviteableRoles(user: AppUser): UserRole[] {
  if (hasRole(user, "admin")) {
    return ["admin", "pastor", "supervisor", "leader", "consolidation", "communication", "member"];
  }

  if (hasRole(user, "pastor")) {
    return ["supervisor", "leader", "consolidation", "communication", "member"];
  }

  if (hasRole(user, "supervisor")) {
    return ["supervisor", "leader", "member"];
  }

  if (hasRole(user, "leader")) {
    return ["member"];
  }

  return [];
}

export function canViewPerson(user: AppUser, person: Person) {
  if (user.churchId !== person.churchId) {
    return false;
  }

  if (hasAnyRole(user, ["admin", "pastor"])) {
    return true;
  }

  if (hasRole(user, "supervisor") && user.cellIds?.includes(person.cellId)) {
    return true;
  }

  if (
    hasRole(user, "leader") &&
    (person.leaderUserId === user.id || person.createdByUserId === user.id || Boolean(user.cellIds?.includes(person.cellId)))
  ) {
    return true;
  }

  if (hasAnyRole(user, ["consolidation", "communication"]) && person.createdByUserId === user.id) {
    return true;
  }

  return hasRole(user, "member") && (person.personUserId === user.id || person.id === user.personId);
}

export function getVisiblePeople(user: AppUser, people: Person[]) {
  return people.filter((person) => canViewPerson(user, person));
}

export function getScopedPeople(user: AppUser, people: Person[], isDemoMode: boolean) {
  void isDemoMode;
  return getVisiblePeople(user, people);
}

export function canViewCell(user: AppUser, cell: Cell) {
  if (user.churchId !== cell.churchId) {
    return false;
  }

  if (hasAnyRole(user, ["admin", "pastor"])) {
    return true;
  }

  if (hasRole(user, "supervisor") && (cell.supervisorUserId === user.id || Boolean(user.cellIds?.includes(cell.id)))) {
    return true;
  }

  if (hasRole(user, "leader") && (cell.leaderUserId === user.id || Boolean(user.cellIds?.includes(cell.id)))) {
    return true;
  }

  if (hasAnyRole(user, ["consolidation", "communication"])) {
    return true;
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

  if (!hasAnyRole(user, ["admin", "pastor", "supervisor", "leader"])) {
    return [];
  }

  return visits.filter((visit) => {
    if (hasAnyRole(user, ["admin", "pastor"])) {
      return visit.churchId === user.churchId;
    }

    if (hasRole(user, "supervisor")) {
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
  const visiblePeople = getVisiblePeople(user, people);
  const visiblePersonIds = new Set(visiblePeople.map((person) => person.id));

  return events.filter((event) => {
    if (event.targetRoles && event.targetRoles.length > 0) {
      return event.churchId === user.churchId && event.targetRoles.some((role) => hasRole(user, role));
    }

    if (hasAnyRole(user, ["admin", "pastor"])) {
      return (
        event.churchId === user.churchId &&
        (event.visibility !== "member" || (!event.cellId && !event.personId))
      );
    }

    if (hasRole(user, "supervisor")) {
      return (
        event.actorUserId === user.id ||
        Boolean(event.cellId && visibleCellIds.has(event.cellId)) ||
        Boolean(event.personId && visiblePersonIds.has(event.personId))
      );
    }

    if (hasRole(user, "leader")) {
      return (
        event.actorUserId === user.id ||
        Boolean(event.cellId && visibleCellIds.has(event.cellId)) ||
        Boolean(event.personId && visiblePersonIds.has(event.personId))
      );
    }

    if (hasRole(user, "consolidation")) {
      return event.actorUserId === user.id;
    }

    if (hasRole(user, "communication")) {
      return event.actorUserId === user.id || (event.churchId === user.churchId && event.visibility === "member");
    }

    return (
      event.visibility === "member" &&
      (
        event.actorUserId === user.id ||
        (event.churchId === user.churchId && !event.cellId && !event.personId) ||
        Boolean(event.personId && visiblePersonIds.has(event.personId)) ||
        Boolean(event.cellId && visiblePeople.some((person) => person.cellId === event.cellId))
      )
    );
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
    return hasAnyRole(user, ["admin", "pastor"]);
  }

  return (
    hasAnyRole(user, ["admin", "pastor", "supervisor", "leader", "consolidation", "communication"])
  );
}

export function canWritePastoralNote(user: AppUser, person: Person) {
  return (
    canViewPerson(user, person) &&
    hasAnyRole(user, ["admin", "pastor", "supervisor", "leader", "consolidation", "communication"])
  );
}

export function canViewPastoralReminder(user: AppUser, reminder: PastoralReminder, cells: Cell[], people: Person[]) {
  if (hasAnyRole(user, ["admin", "pastor"])) {
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

  if (user.churchId !== request.churchId) {
    return false;
  }

  if (request.createdBy === user.id || person?.personUserId === user.id) {
    return true;
  }

  if (hasAnyRole(user, ["admin", "pastor"]) && request.visibility !== "leader_only") {
    return true;
  }

  if (hasRole(user, "supervisor") && cell && canViewCell(user, cell) && request.visibility === "leadership") {
    return true;
  }

  if (
    hasRole(user, "leader") &&
    person &&
    canViewPerson(user, person) &&
    (request.visibility === "leader_only" || request.visibility === "leadership" || request.visibility === "cell_public")
  ) {
    return true;
  }

  if (request.visibility === "pastor_only") {
    return false;
  }

  return Boolean(hasRole(user, "member") && person && request.visibility === "cell_public" && user.cellIds?.includes(person.cellId));
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

export function canViewPeacePair(user: AppUser, pair: PeacePair, cells: Cell[]) {
  if (hasAnyRole(user, ["admin", "pastor"])) {
    return user.churchId === pair.churchId;
  }

  if (pair.createdBy === user.id) {
    return true;
  }

  const relatedCell = cells.find((cell) => cell.id === pair.cellId);
  return Boolean(relatedCell && canViewCell(user, relatedCell));
}

export function getVisiblePeacePairs(user: AppUser, pairs: PeacePair[], cells: Cell[]) {
  return pairs.filter((pair) => canViewPeacePair(user, pair, cells));
}

export function getScopedPeacePairs(user: AppUser, pairs: PeacePair[], cells: Cell[], isDemoMode: boolean) {
  void isDemoMode;
  return getVisiblePeacePairs(user, pairs, cells);
}

export function canViewPeaceHouse(user: AppUser, house: PeaceHouse, cells: Cell[]) {
  if (hasAnyRole(user, ["admin", "pastor"])) {
    return user.churchId === house.churchId;
  }

  if (house.createdBy === user.id) {
    return true;
  }

  const relatedCell = cells.find((cell) => cell.id === house.cellId);
  return Boolean(relatedCell && canViewCell(user, relatedCell));
}

export function getVisiblePeaceHouses(user: AppUser, houses: PeaceHouse[], cells: Cell[]) {
  return houses.filter((house) => canViewPeaceHouse(user, house, cells));
}

export function getScopedPeaceHouses(user: AppUser, houses: PeaceHouse[], cells: Cell[], isDemoMode: boolean) {
  void isDemoMode;
  return getVisiblePeaceHouses(user, houses, cells);
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

  if (user.role === "communication") {
    return "Cria alertas, noticias, eventos e comunicados segmentados para a igreja.";
  }

  return "Ve apenas seu proprio discipulado e informacoes pessoais.";
}

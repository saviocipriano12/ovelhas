import type {
  ActivityEvent,
  CareTask,
  Cell,
  CellReport,
  PastoralReminder,
  Person,
  PersonTrackAccess,
  PrayerRequest,
  SupervisorVisit,
  VideoProgressRecord,
} from "@/lib/data";

export type PastoralNotification = {
  id: string;
  title: string;
  description: string;
  type: "care" | "absence" | "birthday" | "video" | "report" | "supervision" | "agenda" | "structure" | "prayer" | "notice";
  priority: "Baixa" | "Media" | "Alta" | "Urgente";
  href: string;
  createdAt: string;
  personId?: string;
  cellId?: string;
};

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function dateFromBrazilian(value: string) {
  if (!value.includes("/")) {
    return new Date(value);
  }

  const [day, month, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day);
}

export function daysUntilBirthday(birthday: string) {
  if (!birthday || birthday === "--/--" || !birthday.includes("/")) {
    return null;
  }

  const [day, month] = birthday.split("/").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(now.getFullYear(), month - 1, day);

  if (target < today) {
    target.setFullYear(now.getFullYear() + 1);
  }

  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function isWithinNextDays(birthday: string, days: number) {
  if (!birthday || birthday === "--/--" || !birthday.includes("/")) {
    return false;
  }

  const [day, month] = birthday.split("/").map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), month - 1, day);

  if (target < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    target.setFullYear(now.getFullYear() + 1);
  }

  const diff = target.getTime() - now.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function latestReportDate(cell: Cell, reports: CellReport[]) {
  const dates = reports
    .filter((report) => report.cellId === cell.id)
    .map((report) => dateFromBrazilian(report.meetingDate).getTime())
    .filter(Boolean);

  return dates.length ? Math.max(...dates) : 0;
}

function latestVisitDate(cell: Cell, visits: SupervisorVisit[]) {
  const dates = visits
    .filter((visit) => visit.cellId === cell.id)
    .map((visit) => dateFromBrazilian(visit.visitDate).getTime())
    .filter(Boolean);

  return dates.length ? Math.max(...dates) : 0;
}

export function getPastoralNotifications(input: {
  people: Person[];
  cells: Cell[];
  careTasks: CareTask[];
  reports: CellReport[];
  visits: SupervisorVisit[];
  reminders: PastoralReminder[];
  prayerRequests: PrayerRequest[];
  events: ActivityEvent[];
  accesses: PersonTrackAccess[];
  progress: VideoProgressRecord[];
}) {
  const notifications: PastoralNotification[] = [];
  const sevenDaysAgo = daysAgo(7).getTime();

  input.prayerRequests
    .filter((request) => request.status === "open")
    .forEach((request) => {
      notifications.push({
        id: `prayer-${request.id}`,
        title: `Pedido de oracao: ${request.title}`,
        description: request.request,
        type: "prayer",
        priority: request.visibility === "pastor_only" ? "Alta" : "Media",
        href: "/oracao",
        createdAt: request.createdAt,
        personId: request.personId,
        cellId: request.cellId,
      });
    });

  input.events
    .filter((event) => event.visibility === "member")
    .forEach((event) => {
      notifications.push({
        id: `notice-${event.id}`,
        title: event.action || "Aviso da celula",
        description: event.description,
        type: "notice",
        priority: "Media",
        href: "/notificacoes",
        createdAt: event.createdAt,
        personId: event.personId,
        cellId: event.cellId,
      });
    });

  input.reminders
    .filter((reminder) => reminder.status === "open")
    .forEach((reminder) => {
      const dueTime = new Date(reminder.dueAt).getTime();
      if (dueTime <= Date.now() + 24 * 60 * 60 * 1000) {
        notifications.push({
          id: `agenda-${reminder.id}`,
          title: reminder.title,
          description: reminder.description || "Lembrete pastoral pendente.",
          type: "agenda",
          priority: dueTime < Date.now() ? "Alta" : "Media",
          href: "/agenda",
          createdAt: reminder.createdAt,
          personId: reminder.personId,
          cellId: reminder.cellId,
        });
      }
    });

  input.careTasks.forEach((task) => {
    const person = input.people.find((item) => item.id === task.personId);
    notifications.push({
      id: `care-${task.id}`,
      title: task.title,
      description: task.description,
      type: "care",
      priority: task.priority,
      href: person ? `/pessoas/${person.id}` : "/cuidados",
      createdAt: new Date().toISOString(),
      personId: task.personId,
      cellId: person?.cellId,
    });
  });

  input.people.forEach((person) => {
    if (person.cellAbsences >= 2) {
      notifications.push({
        id: `absence-${person.id}-${person.cellAbsences}`,
        title: `${person.name} esta ausente`,
        description:
          person.cellAbsences >= 3
            ? "Tres faltas seguidas. Acompanhamento pastoral urgente."
            : "Duas faltas seguidas. Envie uma mensagem ainda hoje.",
        type: "absence",
        priority: person.cellAbsences >= 3 ? "Urgente" : "Alta",
        href: `/pessoas/${person.id}`,
        createdAt: new Date().toISOString(),
        personId: person.id,
        cellId: person.cellId,
      });
    }

    if (isWithinNextDays(person.birthday, 7)) {
      notifications.push({
        id: `birthday-${person.id}-${person.birthday}`,
        title: `Aniversario de ${person.name}`,
        description: `Prepare uma mensagem de cuidado. Data: ${person.birthday}.`,
        type: "birthday",
        priority: "Baixa",
        href: `/pessoas/${person.id}`,
        createdAt: new Date().toISOString(),
        personId: person.id,
        cellId: person.cellId,
      });
    }
  });

  input.accesses.forEach((access) => {
    const person = input.people.find((item) => item.id === access.personId);
    const personProgress = input.progress.filter((item) => item.personId === access.personId);
    const hasProgress = personProgress.length > 0;
    const lastProgress = personProgress
      .map((item) => item.lastWatchedAt || item.startedAt || item.completedAt || "")
      .filter(Boolean)
      .sort()
      .at(-1);
    const isStopped = lastProgress ? new Date(lastProgress).getTime() < sevenDaysAgo : false;

    if (person && (!hasProgress || isStopped)) {
      notifications.push({
        id: `video-stopped-${access.personId}-${access.trackId}`,
        title: `${person.name} precisa retomar a trilha`,
        description: hasProgress ? "O discipulado esta parado ha mais de 7 dias." : "A trilha foi liberada, mas ainda nao foi iniciada.",
        type: "video",
        priority: hasProgress ? "Media" : "Alta",
        href: `/pessoas/${person.id}`,
        createdAt: new Date().toISOString(),
        personId: person.id,
        cellId: person.cellId,
      });
    }
  });

  input.cells.forEach((cell) => {
    const lastReport = latestReportDate(cell, input.reports);
    const lastVisit = latestVisitDate(cell, input.visits);

    if (!cell.leaderUserId || !cell.supervisorUserId) {
      notifications.push({
        id: `structure-${cell.id}`,
        title: `${cell.name} com responsabilidade incompleta`,
        description: !cell.leaderUserId ? "Celula sem lider definido." : "Celula sem supervisor definido.",
        type: "structure",
        priority: "Urgente",
        href: "/gestao",
        createdAt: new Date().toISOString(),
        cellId: cell.id,
      });
    }

    if (!lastReport || lastReport < sevenDaysAgo) {
      notifications.push({
        id: `report-${cell.id}`,
        title: `${cell.name} sem relatorio recente`,
        description: "Peça ao lider para registrar a ultima reuniao da celula.",
        type: "report",
        priority: "Media",
        href: "/relatorios/novo",
        createdAt: new Date().toISOString(),
        cellId: cell.id,
      });
    }

    if (!lastVisit || lastVisit < sevenDaysAgo) {
      notifications.push({
        id: `supervision-${cell.id}`,
        title: `${cell.name} sem supervisao recente`,
        description: "Supervisor deve acompanhar essa celula nesta semana.",
        type: "supervision",
        priority: "Media",
        href: "/supervisao",
        createdAt: new Date().toISOString(),
        cellId: cell.id,
      });
    }
  });

  const priorityWeight: Record<PastoralNotification["priority"], number> = {
    Urgente: 4,
    Alta: 3,
    Media: 2,
    Baixa: 1,
  };

  return notifications.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
}

export type Priority = "Baixa" | "Media" | "Alta" | "Urgente";
export type UserRole = "admin" | "pastor" | "supervisor" | "leader" | "member";

export type AppUser = {
  id: string;
  name: string;
  role: UserRole;
  churchId: string;
  cellIds?: string[];
  personId?: string;
};

export type Cell = {
  id: string;
  churchId: string;
  name: string;
  leaderUserId: string;
  leaderName: string;
  supervisorUserId: string;
  neighborhood: string;
  meetingDay: string;
  meetingTime: string;
  address: string;
  active: boolean;
};

export type Person = {
  id: string;
  name: string;
  initials: string;
  stage: string;
  status: string;
  phone: string;
  email: string;
  cell: string;
  leader: string;
  discipleshipLeader: string;
  neighborhood: string;
  firstVisit: string;
  birthday: string;
  progress: number;
  cellAbsences: number;
  servicePresent: boolean;
  tone: string;
  churchId: string;
  cellId: string;
  createdByUserId: string;
  leaderUserId: string;
  personUserId?: string;
  photoUrl?: string;
  birthDate?: string;
  address?: string;
  maritalStatus?: string;
  gender?: string;
  tags?: string[];
  privateNotes?: string;
};

export type VideoLesson = {
  id: string;
  title: string;
  description: string;
  duration: string;
  progress: number;
  locked?: boolean;
};

export type DiscipleshipTrack = {
  id: string;
  churchId: string;
  title: string;
  description: string;
  coverUrl: string;
  active: boolean;
  createdAt: string;
};

export type DiscipleshipVideo = {
  id: string;
  trackId: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  orderIndex: number;
  active: boolean;
  createdAt: string;
};

export type PersonTrackAccess = {
  id: string;
  personId: string;
  trackId: string;
  releasedBy: string;
  status: "active" | "completed" | "paused";
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type VideoProgressRecord = {
  id: string;
  personId: string;
  videoId: string;
  status: "not_started" | "watching" | "completed";
  progressPercent: number;
  startedAt?: string;
  completedAt?: string;
  lastWatchedAt?: string;
};

export type Invite = {
  id: string;
  churchId: string;
  token: string;
  email: string;
  name: string;
  role: UserRole;
  cellId: string;
  createdBy: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  acceptedBy?: string;
  acceptedAt?: string;
  createdAt: string;
};

export type PastoralNote = {
  id: string;
  personId: string;
  createdBy: string;
  createdByName: string;
  note: string;
  visibility: "leadership_private" | "pastor_private" | "member_visible";
  createdAt: string;
};

export type PastoralReminder = {
  id: string;
  churchId: string;
  assignedTo: string;
  title: string;
  description: string;
  reminderType: "visita" | "discipulado" | "ligacao" | "reuniao" | "oracao" | "outro";
  dueAt: string;
  status: "open" | "completed";
  personId?: string;
  cellId?: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
};

export type PrayerRequest = {
  id: string;
  churchId: string;
  personId: string;
  cellId?: string;
  title: string;
  request: string;
  visibility: "leader_only" | "leadership" | "pastor_only" | "cell_public";
  status: "open" | "prayed" | "answered";
  createdBy: string;
  createdByName: string;
  answeredNote?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ChurchSettings = {
  churchId: string;
  churchName: string;
  city: string;
  state: string;
  logoUrl: string;
  primaryColor: string;
  welcomeMessage: string;
  absenceMessage: string;
  discipleshipMessage: string;
  privacyContact: string;
  termsText: string;
  updatedAt: string;
};

export type LibraryMaterial = {
  id: string;
  churchId: string;
  trackId?: string;
  title: string;
  description: string;
  materialType: "pdf" | "link" | "video" | "image" | "devotional";
  url: string;
  audience: "member" | "leader" | "leadership";
  active: boolean;
  createdBy: string;
  createdAt: string;
};

export type CertificateRecord = {
  id: string;
  churchId: string;
  personId: string;
  trackId: string;
  title: string;
  issuedBy: string;
  issuedByName: string;
  issuedAt: string;
};

export type CheckInEvent = {
  id: string;
  churchId: string;
  cellId: string;
  personId?: string;
  personName: string;
  checkinType: "cell" | "service";
  checkinDate: string;
  createdAt: string;
};

export type CellRsvp = {
  id: string;
  churchId: string;
  cellId: string;
  personId: string;
  personName: string;
  meetingDate: string;
  response: "yes" | "no" | "maybe";
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type CareTask = {
  id: string;
  personId: string;
  title: string;
  description: string;
  priority: Priority;
  due: string;
  message: string;
};

export type CellReport = {
  id: string;
  cellId: string;
  cellName: string;
  leaderUserId: string;
  leaderName: string;
  supervisorUserId: string;
  meetingDate: string;
  presentCount: number;
  visitorsCount: number;
  serviceCount: number;
  decisionsCount: number;
  highlights: string;
  needs: string;
  prayerRequests: string;
  createdAt: string;
};

export type SupervisorVisit = {
  id: string;
  churchId: string;
  cellId: string;
  cellName: string;
  supervisorUserId: string;
  supervisorName: string;
  leaderUserId: string;
  leaderName: string;
  visitDate: string;
  visitType: "Presencial" | "Online" | "Ligacao";
  leaderPresent: boolean;
  healthScore: number;
  notes: string;
  nextSteps: string;
  createdAt: string;
};

export type ActivityEvent = {
  id: string;
  churchId: string;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  description: string;
  targetType: "cell" | "person" | "report" | "visit" | "video" | "care";
  targetId?: string;
  targetName?: string;
  cellId?: string;
  personId?: string;
  visibility: "leadership" | "cell" | "member";
  createdAt: string;
};

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  pastor: "Pastor",
  supervisor: "Supervisor",
  leader: "Lider de celula",
  member: "Membro",
};

export const users: AppUser[] = [
  {
    id: "admin-ovelhas",
    name: "Admin Ovelhas",
    role: "admin",
    churchId: "igreja-central",
  },
  {
    id: "pastor-daniel",
    name: "Pr. Daniel",
    role: "pastor",
    churchId: "igreja-central",
  },
  {
    id: "supervisor-marcos",
    name: "Marcos Alves",
    role: "supervisor",
    churchId: "igreja-central",
    cellIds: ["cell-casa-da-paz", "cell-renovo"],
  },
  {
    id: "leader-rafael",
    name: "Rafael Lima",
    role: "leader",
    churchId: "igreja-central",
    cellIds: ["cell-casa-da-paz"],
  },
  {
    id: "leader-julia",
    name: "Julia Rocha",
    role: "leader",
    churchId: "igreja-central",
    cellIds: ["cell-renovo"],
  },
  {
    id: "member-maria",
    name: "Maria Clara",
    role: "member",
    churchId: "igreja-central",
    personId: "maria-clara",
  },
];

export const cells: Cell[] = [
  {
    id: "cell-casa-da-paz",
    churchId: "igreja-central",
    name: "Casa da Paz",
    leaderUserId: "leader-rafael",
    leaderName: "Rafael Lima",
    supervisorUserId: "supervisor-marcos",
    neighborhood: "Centro",
    meetingDay: "Terca",
    meetingTime: "20h",
    address: "Rua das Oliveiras, 120",
    active: true,
  },
  {
    id: "cell-renovo",
    churchId: "igreja-central",
    name: "Renovo",
    leaderUserId: "leader-julia",
    leaderName: "Julia Rocha",
    supervisorUserId: "supervisor-marcos",
    neighborhood: "Vila Esperanca",
    meetingDay: "Quinta",
    meetingTime: "19h30",
    address: "Av. Comunhao, 88",
    active: true,
  },
  {
    id: "cell-familia-viva",
    churchId: "igreja-central",
    name: "Familia Viva",
    leaderUserId: "leader-paulo",
    leaderName: "Paulo Nunes",
    supervisorUserId: "supervisor-livia",
    neighborhood: "Bela Vista",
    meetingDay: "Sabado",
    meetingTime: "18h",
    address: "Rua Esperanca, 45",
    active: true,
  },
];

export const people: Person[] = [
  {
    id: "joao-pedro",
    name: "Joao Pedro",
    initials: "JP",
    stage: "Em discipulado",
    status: "Atencao",
    phone: "5511999991111",
    email: "joao@email.com",
    cell: "Casa da Paz",
    leader: "Rafael Lima",
    discipleshipLeader: "Rafael Lima",
    neighborhood: "Centro",
    firstVisit: "12/05/2026",
    birthday: "03/06",
    progress: 68,
    cellAbsences: 0,
    servicePresent: true,
    tone: "bg-emerald-100 text-emerald-800",
    churchId: "igreja-central",
    cellId: "cell-casa-da-paz",
    createdByUserId: "leader-rafael",
    leaderUserId: "leader-rafael",
    personUserId: "member-joao",
  },
  {
    id: "maria-clara",
    name: "Maria Clara",
    initials: "MC",
    stage: "Novo membro",
    status: "Precisa contato",
    phone: "5511988882222",
    email: "maria@email.com",
    cell: "Casa da Paz",
    leader: "Rafael Lima",
    discipleshipLeader: "Rafael Lima",
    neighborhood: "Jardim Luz",
    firstVisit: "28/04/2026",
    birthday: "11/06",
    progress: 12,
    cellAbsences: 2,
    servicePresent: false,
    tone: "bg-amber-100 text-amber-900",
    churchId: "igreja-central",
    cellId: "cell-casa-da-paz",
    createdByUserId: "leader-rafael",
    leaderUserId: "leader-rafael",
    personUserId: "member-maria",
  },
  {
    id: "pedro-henrique",
    name: "Pedro Henrique",
    initials: "PH",
    stage: "Fundamentos",
    status: "Indo bem",
    phone: "5511977773333",
    email: "pedro@email.com",
    cell: "Casa da Paz",
    leader: "Rafael Lima",
    discipleshipLeader: "Rafael Lima",
    neighborhood: "Bela Vista",
    firstVisit: "03/04/2026",
    birthday: "29/05",
    progress: 84,
    cellAbsences: 0,
    servicePresent: true,
    tone: "bg-sky-100 text-sky-800",
    churchId: "igreja-central",
    cellId: "cell-casa-da-paz",
    createdByUserId: "leader-rafael",
    leaderUserId: "leader-rafael",
    personUserId: "member-pedro",
  },
  {
    id: "ana-beatriz",
    name: "Ana Beatriz",
    initials: "AB",
    stage: "Visitante",
    status: "Boas-vindas",
    phone: "5511966664444",
    email: "ana@email.com",
    cell: "Casa da Paz",
    leader: "Rafael Lima",
    discipleshipLeader: "Rafael Lima",
    neighborhood: "Vila Nova",
    firstVisit: "19/05/2026",
    birthday: "15/07",
    progress: 0,
    cellAbsences: 1,
    servicePresent: false,
    tone: "bg-rose-100 text-rose-800",
    churchId: "igreja-central",
    cellId: "cell-casa-da-paz",
    createdByUserId: "leader-rafael",
    leaderUserId: "leader-rafael",
    personUserId: "member-ana",
  },
  {
    id: "lucas-santos",
    name: "Lucas Santos",
    initials: "LS",
    stage: "Batismo",
    status: "Proximo passo",
    phone: "5511955557777",
    email: "lucas@email.com",
    cell: "Casa da Paz",
    leader: "Rafael Lima",
    discipleshipLeader: "Rafael Lima",
    neighborhood: "Morada Verde",
    firstVisit: "16/03/2026",
    birthday: "22/08",
    progress: 92,
    cellAbsences: 0,
    servicePresent: true,
    tone: "bg-violet-100 text-violet-800",
    churchId: "igreja-central",
    cellId: "cell-casa-da-paz",
    createdByUserId: "leader-rafael",
    leaderUserId: "leader-rafael",
    personUserId: "member-lucas",
  },
  {
    id: "bianca-oliveira",
    name: "Bianca Oliveira",
    initials: "BO",
    stage: "Em discipulado",
    status: "Indo bem",
    phone: "5511944448888",
    email: "bianca@email.com",
    cell: "Renovo",
    leader: "Julia Rocha",
    discipleshipLeader: "Julia Rocha",
    neighborhood: "Vila Esperanca",
    firstVisit: "07/05/2026",
    birthday: "02/09",
    progress: 43,
    cellAbsences: 0,
    servicePresent: true,
    tone: "bg-cyan-100 text-cyan-800",
    churchId: "igreja-central",
    cellId: "cell-renovo",
    createdByUserId: "leader-julia",
    leaderUserId: "leader-julia",
    personUserId: "member-bianca",
  },
];

export const videos: VideoLesson[] = [
  {
    id: "salvacao",
    title: "Salvacao e nova vida",
    description: "Primeiros fundamentos da nova caminhada com Cristo.",
    duration: "12 min",
    progress: 100,
  },
  {
    id: "oracao",
    title: "Como orar todos os dias",
    description: "Um jeito simples de criar constancia e intimidade.",
    duration: "9 min",
    progress: 100,
  },
  {
    id: "palavra",
    title: "Palavra e crescimento",
    description: "Como ler, praticar e crescer com a Palavra.",
    duration: "14 min",
    progress: 64,
  },
  {
    id: "celula",
    title: "Vida em celula",
    description: "Comunhao, cuidado e caminhada com pessoas.",
    duration: "11 min",
    progress: 0,
  },
  {
    id: "servico",
    title: "Servindo com alegria",
    description: "Descobrindo dons e primeiros passos no servico.",
    duration: "13 min",
    progress: 0,
    locked: true,
  },
];

export const discipleshipTracks: DiscipleshipTrack[] = [
  {
    id: "track-primeiros-passos",
    churchId: "igreja-central",
    title: "Primeiros Passos",
    description: "Uma trilha acolhedora para firmar a nova caminhada com Cristo.",
    coverUrl: "",
    active: true,
    createdAt: "2026-05-01T10:00:00.000Z",
  },
  {
    id: "track-batismo",
    churchId: "igreja-central",
    title: "Preparacao para Batismo",
    description: "Fundamentos para quem esta se preparando para o batismo.",
    coverUrl: "",
    active: true,
    createdAt: "2026-05-03T10:00:00.000Z",
  },
];

export const discipleshipVideos: DiscipleshipVideo[] = videos.map((video, index) => ({
  id: `video-${video.id}`,
  trackId: "track-primeiros-passos",
  title: video.title,
  description: video.description,
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  thumbnailUrl: "",
  durationSeconds: Number.parseInt(video.duration, 10) * 60 || 600,
  orderIndex: index + 1,
  active: true,
  createdAt: "2026-05-01T10:00:00.000Z",
}));

export const personTrackAccesses: PersonTrackAccess[] = [
  {
    id: "access-maria-primeiros-passos",
    personId: "maria-clara",
    trackId: "track-primeiros-passos",
    releasedBy: "leader-rafael",
    status: "active",
    startedAt: "2026-05-20T19:00:00.000Z",
    createdAt: "2026-05-20T19:00:00.000Z",
  },
  {
    id: "access-joao-primeiros-passos",
    personId: "joao-pedro",
    trackId: "track-primeiros-passos",
    releasedBy: "leader-rafael",
    status: "active",
    startedAt: "2026-05-18T19:00:00.000Z",
    createdAt: "2026-05-18T19:00:00.000Z",
  },
];

export const videoProgressRecords: VideoProgressRecord[] = [
  {
    id: "progress-maria-salvacao",
    personId: "maria-clara",
    videoId: "video-salvacao",
    status: "completed",
    progressPercent: 100,
    startedAt: "2026-05-20T19:00:00.000Z",
    completedAt: "2026-05-20T19:18:00.000Z",
    lastWatchedAt: "2026-05-20T19:18:00.000Z",
  },
  {
    id: "progress-maria-oracao",
    personId: "maria-clara",
    videoId: "video-oracao",
    status: "watching",
    progressPercent: 42,
    startedAt: "2026-05-21T19:00:00.000Z",
    lastWatchedAt: "2026-05-21T19:08:00.000Z",
  },
  {
    id: "progress-joao-salvacao",
    personId: "joao-pedro",
    videoId: "video-salvacao",
    status: "completed",
    progressPercent: 100,
    completedAt: "2026-05-18T19:18:00.000Z",
    lastWatchedAt: "2026-05-18T19:18:00.000Z",
  },
  {
    id: "progress-joao-oracao",
    personId: "joao-pedro",
    videoId: "video-oracao",
    status: "completed",
    progressPercent: 100,
    completedAt: "2026-05-19T19:18:00.000Z",
    lastWatchedAt: "2026-05-19T19:18:00.000Z",
  },
  {
    id: "progress-joao-palavra",
    personId: "joao-pedro",
    videoId: "video-palavra",
    status: "watching",
    progressPercent: 64,
    startedAt: "2026-05-22T19:00:00.000Z",
    lastWatchedAt: "2026-05-22T19:09:00.000Z",
  },
];

export const seedInvites: Invite[] = [
  {
    id: "invite-membro-casa-da-paz",
    churchId: "igreja-central",
    token: "demo-casa-da-paz",
    email: "",
    name: "Novo membro",
    role: "member",
    cellId: "cell-casa-da-paz",
    createdBy: "leader-rafael",
    status: "pending",
    expiresAt: "2026-12-31T23:59:59.000Z",
    createdAt: "2026-05-23T12:00:00.000Z",
  },
];

export const seedPastoralNotes: PastoralNote[] = [
  {
    id: "note-maria-1",
    personId: "maria-clara",
    createdBy: "leader-rafael",
    createdByName: "Rafael Lima",
    note: "Entrar em contato com cuidado e perguntar como esta a rotina dela nesta semana.",
    visibility: "leadership_private",
    createdAt: "2026-05-22T10:00:00.000Z",
  },
  {
    id: "note-joao-1",
    personId: "joao-pedro",
    createdBy: "leader-rafael",
    createdByName: "Rafael Lima",
    note: "Celebrar progresso na trilha e alinhar proximo passo para batismo.",
    visibility: "member_visible",
    createdAt: "2026-05-22T12:00:00.000Z",
  },
];

export const seedPastoralReminders: PastoralReminder[] = [
  {
    id: "reminder-maria-visita",
    churchId: "igreja-central",
    assignedTo: "leader-rafael",
    title: "Conversar com Maria",
    description: "Alinhar como ela esta e marcar retomada da celula.",
    reminderType: "ligacao",
    dueAt: "2026-05-23T18:00:00.000Z",
    status: "open",
    personId: "maria-clara",
    cellId: "cell-casa-da-paz",
    createdBy: "leader-rafael",
    createdAt: "2026-05-22T12:00:00.000Z",
  },
  {
    id: "reminder-supervisao-renovo",
    churchId: "igreja-central",
    assignedTo: "supervisor-marcos",
    title: "Revisar celula Renovo",
    description: "Ver relatorio da semana e combinar proximo passo com Julia.",
    reminderType: "reuniao",
    dueAt: "2026-05-24T15:00:00.000Z",
    status: "open",
    cellId: "cell-renovo",
    createdBy: "supervisor-marcos",
    createdAt: "2026-05-22T12:00:00.000Z",
  },
];

export const seedPrayerRequests: PrayerRequest[] = [
  {
    id: "prayer-maria-familia",
    churchId: "igreja-central",
    personId: "maria-clara",
    cellId: "cell-casa-da-paz",
    title: "Familia e constancia",
    request: "Pedir oracao pela familia e para conseguir voltar com constancia para a celula.",
    visibility: "leader_only",
    status: "open",
    createdBy: "member-maria",
    createdByName: "Maria Clara",
    createdAt: "2026-05-23T10:00:00.000Z",
  },
  {
    id: "prayer-joao-batismo",
    churchId: "igreja-central",
    personId: "joao-pedro",
    cellId: "cell-casa-da-paz",
    title: "Preparacao para batismo",
    request: "Orar pelo proximo passo do batismo e pela firmeza na caminhada.",
    visibility: "leadership",
    status: "prayed",
    createdBy: "leader-rafael",
    createdByName: "Rafael Lima",
    createdAt: "2026-05-22T11:00:00.000Z",
    updatedAt: "2026-05-22T19:00:00.000Z",
  },
];

export const seedChurchSettings: ChurchSettings = {
  churchId: "igreja-central",
  churchName: "Igreja Central",
  city: "",
  state: "",
  logoUrl: "",
  primaryColor: "#064e3b",
  welcomeMessage:
    "Ola, {nome}! Que alegria ter voce conosco. Queremos caminhar com voce e te ajudar nos proximos passos.",
  absenceMessage:
    "Ola, {nome}! Sentimos sua falta na celula. Esta tudo bem? Estamos aqui para caminhar com voce.",
  discipleshipMessage:
    "Ola, {nome}! Vi seu progresso no discipulado. Como esta sendo essa caminhada para voce?",
  privacyContact: "Savio Cipriano",
  termsText:
    "Os dados cadastrados no Ovelhas sao usados para cuidado pastoral, discipulado, presenca, comunicacao e acompanhamento interno da igreja.",
  updatedAt: "2026-05-23T12:00:00.000Z",
};

export const seedLibraryMaterials: LibraryMaterial[] = [
  {
    id: "material-primeiros-passos-devocional",
    churchId: "igreja-central",
    trackId: "track-primeiros-passos",
    title: "Devocional Primeiros Passos",
    description: "Leitura de apoio para a primeira semana de discipulado.",
    materialType: "devotional",
    url: "https://ovelhas.vercel.app/meu-discipulado",
    audience: "member",
    active: true,
    createdBy: "pastor-daniel",
    createdAt: "2026-05-20T10:00:00.000Z",
  },
  {
    id: "material-lider-cuidado",
    churchId: "igreja-central",
    title: "Guia rapido de acompanhamento",
    description: "Orientacoes para lideres cuidarem de ausencias e novos membros.",
    materialType: "link",
    url: "https://ovelhas.vercel.app/cuidados",
    audience: "leader",
    active: true,
    createdBy: "pastor-daniel",
    createdAt: "2026-05-20T11:00:00.000Z",
  },
];

export const seedCertificateRecords: CertificateRecord[] = [
  {
    id: "certificate-joao-primeiros-passos",
    churchId: "igreja-central",
    personId: "joao-pedro",
    trackId: "track-primeiros-passos",
    title: "Primeiros Passos",
    issuedBy: "leader-rafael",
    issuedByName: "Rafael Lima",
    issuedAt: "2026-05-23T12:00:00.000Z",
  },
];

export const seedCheckIns: CheckInEvent[] = [
  {
    id: "checkin-maria-casa-da-paz",
    churchId: "igreja-central",
    cellId: "cell-casa-da-paz",
    personId: "maria-clara",
    personName: "Maria Clara",
    checkinType: "cell",
    checkinDate: "2026-05-23",
    createdAt: "2026-05-23T20:00:00.000Z",
  },
];

export const seedCellRsvps: CellRsvp[] = [];

export const careTasks: CareTask[] = [
  {
    id: "maria-ausente",
    personId: "maria-clara",
    title: "Maria faltou 2 celulas seguidas",
    description: "Sugestao: enviar mensagem ainda hoje e perguntar como ela esta.",
    priority: "Alta",
    due: "Hoje",
    message: "Ola, Maria! Sentimos sua falta na celula. Esta tudo bem? Estamos aqui para caminhar com voce.",
  },
  {
    id: "ana-boas-vindas",
    personId: "ana-beatriz",
    title: "Ana visitou pela primeira vez",
    description: "Envie uma mensagem de boas-vindas e convide para a proxima celula.",
    priority: "Media",
    due: "Hoje",
    message: "Ola, Ana! Que alegria ter voce conosco. Queremos caminhar com voce e te ajudar nos proximos passos.",
  },
  {
    id: "joao-video",
    personId: "joao-pedro",
    title: "Joao parou no video 3",
    description: "Ele iniciou a trilha, mas nao avancou nos ultimos dias.",
    priority: "Media",
    due: "Amanha",
    message: "Ola, Joao! Vi que voce chegou no video sobre Palavra. Como esta sendo o discipulado para voce?",
  },
  {
    id: "pedro-celebrar",
    personId: "pedro-henrique",
    title: "Pedro chegou a 84% da trilha",
    description: "Celebre o progresso e alinhe o proximo passo.",
    priority: "Baixa",
    due: "Esta semana",
    message: "Ola, Pedro! Que alegria ver seu progresso no discipulado. Vamos conversar sobre o proximo passo?",
  },
];

export const seedCellReports: CellReport[] = [
  {
    id: "report-casa-da-paz-1",
    cellId: "cell-casa-da-paz",
    cellName: "Casa da Paz",
    leaderUserId: "leader-rafael",
    leaderName: "Rafael Lima",
    supervisorUserId: "supervisor-marcos",
    meetingDate: "21/05/2026",
    presentCount: 4,
    visitorsCount: 1,
    serviceCount: 3,
    decisionsCount: 0,
    highlights: "Boa participacao no estudo e Maria precisa de contato esta semana.",
    needs: "Acompanhar Maria e convidar Ana novamente.",
    prayerRequests: "Orar por constancia dos novos membros.",
    createdAt: "2026-05-21T22:20:00.000Z",
  },
  {
    id: "report-renovo-1",
    cellId: "cell-renovo",
    cellName: "Renovo",
    leaderUserId: "leader-julia",
    leaderName: "Julia Rocha",
    supervisorUserId: "supervisor-marcos",
    meetingDate: "20/05/2026",
    presentCount: 1,
    visitorsCount: 0,
    serviceCount: 1,
    decisionsCount: 0,
    highlights: "Bianca avancou na trilha e pediu ajuda para manter rotina de leitura.",
    needs: "Acompanhar progresso nos videos.",
    prayerRequests: "Orar pela familia de Bianca.",
    createdAt: "2026-05-20T21:40:00.000Z",
  },
];

export const seedSupervisorVisits: SupervisorVisit[] = [
  {
    id: "visit-casa-da-paz-1",
    churchId: "igreja-central",
    cellId: "cell-casa-da-paz",
    cellName: "Casa da Paz",
    supervisorUserId: "supervisor-marcos",
    supervisorName: "Marcos Alves",
    leaderUserId: "leader-rafael",
    leaderName: "Rafael Lima",
    visitDate: "22/05/2026",
    visitType: "Presencial",
    leaderPresent: true,
    healthScore: 82,
    notes: "Celula acolhedora, boa participacao e necessidade de acompanhar Maria.",
    nextSteps: "Rafael vai entrar em contato com Maria e alinhar proximo video de Joao.",
    createdAt: "2026-05-22T22:10:00.000Z",
  },
  {
    id: "visit-renovo-1",
    churchId: "igreja-central",
    cellId: "cell-renovo",
    cellName: "Renovo",
    supervisorUserId: "supervisor-marcos",
    supervisorName: "Marcos Alves",
    leaderUserId: "leader-julia",
    leaderName: "Julia Rocha",
    visitDate: "18/05/2026",
    visitType: "Online",
    leaderPresent: true,
    healthScore: 76,
    notes: "Julia esta acompanhando bem Bianca, mas precisa registrar relatorios com mais frequencia.",
    nextSteps: "Supervisor revisara o proximo relatorio com Julia.",
    createdAt: "2026-05-18T20:30:00.000Z",
  },
];

export const seedActivityEvents: ActivityEvent[] = [
  {
    id: "activity-report-casa-da-paz",
    churchId: "igreja-central",
    actorUserId: "leader-rafael",
    actorName: "Rafael Lima",
    actorRole: "leader",
    action: "Enviou relatorio",
    description: "Rafael registrou a reuniao da celula Casa da Paz.",
    targetType: "report",
    targetId: "report-casa-da-paz-1",
    targetName: "Relatorio Casa da Paz",
    cellId: "cell-casa-da-paz",
    visibility: "leadership",
    createdAt: "2026-05-21T22:20:00.000Z",
  },
  {
    id: "activity-visit-casa-da-paz",
    churchId: "igreja-central",
    actorUserId: "supervisor-marcos",
    actorName: "Marcos Alves",
    actorRole: "supervisor",
    action: "Visitou celula",
    description: "Marcos acompanhou a celula Casa da Paz e deixou proximos passos.",
    targetType: "visit",
    targetId: "visit-casa-da-paz-1",
    targetName: "Casa da Paz",
    cellId: "cell-casa-da-paz",
    visibility: "leadership",
    createdAt: "2026-05-22T22:10:00.000Z",
  },
  {
    id: "activity-member-video",
    churchId: "igreja-central",
    actorUserId: "member-maria",
    actorName: "Maria Clara",
    actorRole: "member",
    action: "Iniciou discipulado",
    description: "Maria acessou a trilha Primeiros Passos.",
    targetType: "video",
    targetName: "Primeiros Passos",
    cellId: "cell-casa-da-paz",
    personId: "maria-clara",
    visibility: "cell",
    createdAt: "2026-05-20T19:00:00.000Z",
  },
];

export const timeline = [
  "Primeira visita registrada",
  "Entrou na celula Casa da Paz",
  "Trilha Primeiros Passos liberada",
  "Concluiu 2 videos",
  "Contato pastoral realizado",
];

export function getPerson(id: string) {
  return people.find((person) => person.id === id);
}

export function getTaskPerson(task: CareTask) {
  return getPerson(task.personId) ?? people[0];
}

export function getCareScore(person: Person) {
  const absencePenalty = person.cellAbsences * 18;
  const progressBonus = Math.round(person.progress * 0.45);
  const serviceBonus = person.servicePresent ? 14 : 0;
  return Math.max(8, Math.min(100, 42 + progressBonus + serviceBonus - absencePenalty));
}

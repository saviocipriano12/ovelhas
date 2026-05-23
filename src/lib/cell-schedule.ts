const dayIndex: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getNextMeetingDate(meetingDay: string, from = new Date()) {
  const normalized = meetingDay.trim().toLowerCase();
  const target = dayIndex[normalized] ?? from.getDay();
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);

  const daysUntil = (target - base.getDay() + 7) % 7;
  base.setDate(base.getDate() + daysUntil);
  return toIsoDate(base);
}

export function shouldAskForRsvp(meetingDate: string, from = new Date()) {
  const today = new Date(from);
  today.setHours(12, 0, 0, 0);

  const target = new Date(`${meetingDate}T12:00:00`);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays <= 2;
}

export function rsvpLabel(response?: "yes" | "no" | "maybe") {
  if (response === "yes") {
    return "Confirmou";
  }

  if (response === "no") {
    return "Nao vai";
  }

  if (response === "maybe") {
    return "Talvez";
  }

  return "Sem resposta";
}

export function rsvpTone(response?: "yes" | "no" | "maybe") {
  if (response === "yes") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (response === "no") {
    return "bg-rose-100 text-rose-800";
  }

  if (response === "maybe") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-slate-100 text-slate-500";
}

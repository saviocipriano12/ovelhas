import type { Person, SupervisorVisit } from "@/lib/data";

export type MonthlyPoint = {
  key: string;
  label: string;
  value: number | null;
};

export type StagePoint = {
  label: string;
  value: number;
};

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const STAGE_ORDER = ["Visitante", "Novo membro", "Em discipulado", "Batismo", "Servindo"];

function parseFlexibleDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (value.includes("/")) {
    const [day, month, year] = value.split("/").map(Number);
    if (!day || !month || !year) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(months: number, from = new Date()) {
  const buckets: { key: string; label: string }[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(from.getFullYear(), from.getMonth() - offset, 1);
    buckets.push({ key: monthKey(date), label: MONTH_LABEL_FORMAT.format(date).replace(".", "") });
  }

  return buckets;
}

export function monthlyNewPeople(people: Person[], months = 6): MonthlyPoint[] {
  const buckets = lastNMonths(months);
  const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));

  people.forEach((person) => {
    const date = parseFlexibleDate(person.firstVisit);
    if (!date) {
      return;
    }

    const key = monthKey(date);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });

  return buckets.map((bucket) => ({ key: bucket.key, label: bucket.label, value: counts.get(bucket.key) ?? 0 }));
}

export function monthlyAverageHealth(visits: SupervisorVisit[], months = 6): MonthlyPoint[] {
  const buckets = lastNMonths(months);
  const sums = new Map(buckets.map((bucket) => [bucket.key, { total: 0, count: 0 }]));

  visits.forEach((visit) => {
    const date = parseFlexibleDate(visit.visitDate);
    if (!date) {
      return;
    }

    const bucket = sums.get(monthKey(date));
    if (bucket) {
      bucket.total += visit.healthScore;
      bucket.count += 1;
    }
  });

  return buckets.map((bucket) => {
    const data = sums.get(bucket.key);
    const value = data && data.count > 0 ? Math.round(data.total / data.count) : null;
    return { key: bucket.key, label: bucket.label, value };
  });
}

export function stageDistribution(people: Person[]): StagePoint[] {
  const counts = new Map<string, number>();

  people.forEach((person) => {
    const stage = STAGE_ORDER.includes(person.stage) ? person.stage : "Outro";
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  });

  const labels = counts.has("Outro") ? [...STAGE_ORDER, "Outro"] : STAGE_ORDER;
  return labels.map((label) => ({ label, value: counts.get(label) ?? 0 }));
}

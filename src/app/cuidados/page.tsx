"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CareTaskCard } from "@/components/care-task-card";
import { SectionHeader } from "@/components/section-header";
import { getVisibleCareTasks } from "@/lib/access-control";
import { useCareTasks, useCompletedCare, useLocalPeople } from "@/lib/local-store";

export default function CarePage() {
  const { currentUser } = useAuth();
  const { people } = useLocalPeople();
  const { tasks } = useCareTasks();
  const { completedSet, toggleCompleted } = useCompletedCare();
  const visibleTasks = getVisibleCareTasks(currentUser, tasks, people);
  const pendingTasks = visibleTasks.filter((task) => !completedSet.has(task.id));
  const completedTasks = visibleTasks.filter((task) => completedSet.has(task.id));

  return (
    <AppShell>
      <section className="animate-enter space-y-4">
        <SectionHeader
          eyebrow="Acompanhamentos"
          title="Fila de cuidado pastoral"
          action={
            <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
              {pendingTasks.length} pendentes
            </span>
          }
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {pendingTasks.map((task) => (
            <CareTaskCard key={task.id} task={task} onComplete={() => toggleCompleted(task.id)} />
          ))}
        </div>

        {completedTasks.length > 0 && (
          <section className="pt-2">
            <SectionHeader eyebrow="Concluidos" title="Cuidados finalizados" />
            <div className="grid gap-3 lg:grid-cols-2">
              {completedTasks.map((task) => (
                <CareTaskCard
                  key={task.id}
                  task={task}
                  completed
                  onComplete={() => toggleCompleted(task.id)}
                />
              ))}
            </div>
          </section>
        )}
      </section>
    </AppShell>
  );
}

"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CareTaskCard } from "@/components/care-task-card";
import { SectionHeader } from "@/components/section-header";
import { getVisibleCareTasks } from "@/lib/access-control";
import { useCareTasks, useLocalPeople } from "@/lib/local-store";

export default function CarePage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { tasks, completeCareTask } = useCareTasks();
  const visibleTasks = getVisibleCareTasks(currentUser, tasks, people);
  const pendingTasks = visibleTasks;

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
            <CareTaskCard key={task.id} task={task} onComplete={() => completeCareTask(task.id, !isDemoMode)} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

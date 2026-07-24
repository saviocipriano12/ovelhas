"use client";

import { HeartHandshake } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CareTaskCard } from "@/components/care-task-card";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { getScopedCareTasks } from "@/lib/access-control";
import { useCareTasks, useLocalPeople } from "@/lib/local-store";

export default function CarePage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { tasks, completeCareTask, isLoadingTasks, tasksLoadError } = useCareTasks();
  const toast = useToast();
  const visibleTasks = getScopedCareTasks(currentUser, tasks, people, isDemoMode);
  const pendingTasks = visibleTasks;

  async function handleComplete(taskId: string) {
    const result = await completeCareTask(taskId, !isDemoMode);

    if (!result.ok) {
      toast.error(`Nao consegui concluir o cuidado: ${result.error}`);
      return;
    }

    toast.success("Cuidado concluido.");
  }

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

        {tasksLoadError && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
            Nao consegui carregar cuidados: {tasksLoadError}
          </div>
        )}

        {isLoadingTasks && pendingTasks.length === 0 ? (
          <EmptyState icon={HeartHandshake} title="Carregando cuidados..." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pendingTasks.map((task) => (
              <CareTaskCard
                key={task.id}
                task={task}
                person={people.find((person) => person.id === task.personId)}
                onComplete={() => handleComplete(task.id)}
              />
            ))}
            {pendingTasks.length === 0 && (
              <EmptyState
                icon={HeartHandshake}
                title="Nenhum cuidado pendente"
                description="Quando alguem precisar de acompanhamento, vai aparecer aqui."
                className="lg:col-span-2"
              />
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}

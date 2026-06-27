import Link from "next/link";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TaskCompleteCheckbox } from "@/features/tasks/components/task-complete-checkbox";
import { TaskItemActions } from "@/features/tasks/components/task-item-actions";
import { hasPermission } from "@/lib/auth";
import type { TaskListRow } from "@/services/tasks/task.service";
import type { AppUserRole } from "@/types/auth";
import { formatDateTime } from "@/lib/helpers/date";
import { cn } from "@/lib/utils";

type TasksViewProps = {
  tasks: TaskListRow[];
  role: AppUserRole;
};

export function TasksView({ tasks, role }: TasksViewProps) {
  const canWrite = hasPermission(role, "tasks:write");

  return (
    <ModuleShellFlow className="bg-background">
      <main className="w-full p-6 pb-12">
        <PageHeader
          title="Tareas"
          description="Lista simple de pendientes: título, descripción y marcar cuando esté lista."
          action={
            canWrite ? { label: "Nueva tarea", href: "/tasks/new" } : undefined
          }
        />

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin tareas.{" "}
            {canWrite ? (
              <Link href="/tasks/new" className="text-primary underline">
                Crear una
              </Link>
            ) : null}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border border-border bg-card">
            {tasks.map((task) => {
              const completed = task.status === "COMPLETED";
              const readOnlyEmailTask = task.source === "email";
              return (
                <li
                  key={task.id}
                  className="flex items-start gap-3 px-4 py-3 sm:gap-4 sm:px-5"
                >
                  <div className="pt-0.5">
                    {canWrite && !readOnlyEmailTask ? (
                      <TaskCompleteCheckbox taskId={task.id} status={task.status} />
                    ) : (
                      <input
                        type="checkbox"
                        checked={completed}
                        disabled
                        readOnly
                        aria-label={completed ? "Completada" : "Pendiente"}
                        className="h-4 w-4 rounded border-border accent-pragma-electric"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium text-foreground",
                        completed && "text-muted-foreground line-through",
                      )}
                    >
                      {task.title}
                    </p>
                    {readOnlyEmailTask ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Generada desde correo Airbnb
                      </p>
                    ) : null}
                    {task.description?.trim() ? (
                      <p
                        className={cn(
                          "mt-1 text-sm text-muted-foreground",
                          completed && "line-through opacity-80",
                        )}
                      >
                        {task.description}
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        "mt-1 text-xs tabular-nums text-muted-foreground/90",
                        completed && "opacity-80",
                      )}
                    >
                      Creada {formatDateTime(task.createdAt)}
                    </p>
                  </div>
                  {canWrite && !readOnlyEmailTask ? (
                    <TaskItemActions taskId={task.id} taskTitle={task.title} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </ModuleShellFlow>
  );
}

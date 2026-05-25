import Link from "next/link";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskStatusSelect } from "@/features/tasks/components/task-status-select";
import { hasPermission, requirePermission } from "@/lib/auth";
import { redirectIfMissingPlanFeature } from "@/lib/billing/require-plan-feature";
import { formatDate } from "@/lib/helpers/date";
import { taskTypeLabels } from "@/lib/labels";
import { listTasks } from "@/services/tasks/task.service";
import type { AppUserRole } from "@/types/auth";

export default async function TasksPage() {
  await redirectIfMissingPlanFeature("tasks", "/tasks");
  const auth = await requirePermission("tasks:read");
  const tasks = await listTasks();
  const canWrite = hasPermission(auth.role as AppUserRole, "tasks:write");

  return (
    <ModuleShellFlow className="bg-background">
      <main className="w-full p-6 pb-12">
        <PageHeader
          title="Tareas operativas"
          description={`${tasks.length} tareas`}
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
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Propiedad</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>{taskTypeLabels[t.type]}</TableCell>
                    <TableCell>{t.property?.name ?? "—"}</TableCell>
                    <TableCell>
                      {t.dueDate ? formatDate(t.dueDate) : "—"}
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <TaskStatusSelect taskId={t.id} current={t.status} />
                      ) : (
                        t.status
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </ModuleShellFlow>
  );
}

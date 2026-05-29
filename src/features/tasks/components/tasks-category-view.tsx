import Link from "next/link";
import type { TaskStatus, TaskType } from "@prisma/client";
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
import { hasPermission } from "@/lib/auth";
import { formatDate } from "@/lib/helpers/date";
import { taskTypeLabels } from "@/lib/labels";
import type { TaskCategoryConfig } from "@/lib/tasks/task-categories";
import type { AppUserRole } from "@/types/auth";

type TaskRow = {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  dueDate: Date | null;
  property: { name: string } | null;
};

type TasksCategoryViewProps = {
  category: TaskCategoryConfig;
  tasks: TaskRow[];
  role: AppUserRole;
};

export function TasksCategoryView({
  category,
  tasks,
  role,
}: TasksCategoryViewProps) {
  const canWrite = hasPermission(role, "tasks:write");
  const newTaskHref = `/tasks/new?category=${category.slug}`;

  return (
    <ModuleShellFlow className="bg-background">
      <main className="w-full p-6 pb-12">
        <PageHeader
          title={category.title}
          description={category.description}
          action={
            canWrite
              ? { label: "Nueva tarea", href: newTaskHref }
              : undefined
          }
        />

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin tareas.{" "}
            {canWrite ? (
              <Link href={newTaskHref} className="text-primary underline">
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
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>{taskTypeLabels[task.type]}</TableCell>
                    <TableCell>{task.property?.name ?? "—"}</TableCell>
                    <TableCell>
                      {task.dueDate ? formatDate(task.dueDate) : "—"}
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <TaskStatusSelect
                          taskId={task.id}
                          current={task.status}
                          categorySlug={category.slug}
                        />
                      ) : (
                        task.status
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

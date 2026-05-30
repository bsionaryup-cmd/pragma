import { notFound } from "next/navigation";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TaskForm } from "@/features/tasks/components/task-form";
import { requirePermission } from "@/lib/auth";
import { getTaskById } from "@/services/tasks/task.service";

type EditTaskPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTaskPage({ params }: EditTaskPageProps) {
  await requirePermission("tasks:write");
  const { id } = await params;
  const task = await getTaskById(id);

  if (!task) {
    notFound();
  }

  return (
    <ModuleShellFlow className="bg-background">
      <main className="w-full p-6 pb-12">
        <PageHeader
          backHref="/tasks"
          backLabel="Tareas"
          title="Editar tarea"
          description="Actualiza el título o la descripción."
        />
        <TaskForm
          taskId={task.id}
          defaultValues={{
            title: task.title,
            description: task.description ?? "",
          }}
        />
      </main>
    </ModuleShellFlow>
  );
}

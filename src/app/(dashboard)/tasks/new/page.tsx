import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TaskForm } from "@/features/tasks/components/task-form";
import { requirePermission } from "@/lib/auth";

export default async function NewTaskPage() {
  await requirePermission("tasks:write");

  return (
    <ModuleShellFlow className="bg-background">
      <main className="w-full p-6 pb-12">
        <PageHeader
          backHref="/tasks"
          backLabel="Tareas"
          title="Nueva tarea"
          description="Solo título y descripción. Márcala completada desde la lista."
        />
        <TaskForm />
      </main>
    </ModuleShellFlow>
  );
}

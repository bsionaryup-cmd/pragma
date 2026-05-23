import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TaskForm } from "@/features/tasks/components/task-form";
import { requirePermission } from "@/lib/auth";
import { listPropertiesForSelect } from "@/services/properties/property.service";

export default async function NewTaskPage() {
  const auth = await requirePermission("tasks:write");
  const properties = await listPropertiesForSelect(auth.dbUserId);

  return (
    <ModuleShellFlow className="bg-background">
      <main className="w-full p-6 pb-12">
        <PageHeader
          backHref="/tasks"
          backLabel="Tareas"
          title="Crear tarea operativa"
        />
        <TaskForm properties={properties} />
      </main>
    </ModuleShellFlow>
  );
}

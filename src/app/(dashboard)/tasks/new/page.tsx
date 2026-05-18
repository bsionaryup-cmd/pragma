import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { TaskForm } from "@/features/tasks/components/task-form";
import { requirePermission } from "@/lib/auth";
import { listPropertiesForSelect } from "@/services/properties/property.service";

export default async function NewTaskPage() {
  await requirePermission("tasks:write");
  const properties = await listPropertiesForSelect();

  return (
    <>
      <Topbar title="Nueva tarea" />
      <main className="flex-1 overflow-y-auto p-6">
        <PageHeader title="Crear tarea operativa" />
        <TaskForm properties={properties} />
      </main>
    </>
  );
}

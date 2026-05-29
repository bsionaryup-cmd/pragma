import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TaskForm } from "@/features/tasks/components/task-form";
import { requirePermission } from "@/lib/auth";
import {
  DEFAULT_TASK_CATEGORY,
  getTaskCategoryConfig,
  isTaskCategorySlug,
} from "@/lib/tasks/task-categories";
import { listPropertiesForSelect } from "@/services/properties/property.service";

type NewTaskPageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function NewTaskPage({ searchParams }: NewTaskPageProps) {
  const auth = await requirePermission("tasks:write");
  const { category: categoryParam } = await searchParams;
  const categorySlug = isTaskCategorySlug(categoryParam ?? "")
    ? categoryParam
    : DEFAULT_TASK_CATEGORY;
  const category = getTaskCategoryConfig(categorySlug!)!;

  const properties = await listPropertiesForSelect(auth.dbUserId);

  return (
    <ModuleShellFlow className="bg-background">
      <main className="w-full p-6 pb-12">
        <PageHeader
          backHref={`/tasks/${category.slug}`}
          backLabel={category.title}
          title={`Nueva tarea · ${category.title}`}
        />
        <TaskForm properties={properties} categorySlug={category.slug} />
      </main>
    </ModuleShellFlow>
  );
}

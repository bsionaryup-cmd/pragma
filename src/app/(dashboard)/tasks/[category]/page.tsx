import { notFound } from "next/navigation";
import { TasksCategoryView } from "@/features/tasks/components/tasks-category-view";
import { requirePermission } from "@/lib/auth";
import { redirectIfMissingPlanFeature } from "@/lib/billing/require-plan-feature";
import { getTaskCategoryConfig } from "@/lib/tasks/task-categories";
import { listTasks } from "@/services/tasks/task.service";
import type { AppUserRole } from "@/types/auth";

type TasksCategoryPageProps = {
  params: Promise<{ category: string }>;
};

export default async function TasksCategoryPage({
  params,
}: TasksCategoryPageProps) {
  const { category: categorySlug } = await params;
  const category = getTaskCategoryConfig(categorySlug);

  if (!category) {
    notFound();
  }

  await redirectIfMissingPlanFeature("tasks", `/tasks/${category.slug}`);
  const auth = await requirePermission("tasks:read");

  const tasks = await listTasks({ type: category.taskType });

  return (
    <TasksCategoryView
      category={category}
      tasks={tasks}
      role={auth.role as AppUserRole}
    />
  );
}

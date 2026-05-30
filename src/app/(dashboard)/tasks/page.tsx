import { TasksView } from "@/features/tasks/components/tasks-view";
import { requirePermission } from "@/lib/auth";
import { redirectIfMissingPlanFeature } from "@/lib/billing/require-plan-feature";
import { listTasks } from "@/services/tasks/task.service";
import type { AppUserRole } from "@/types/auth";

export default async function TasksPage() {
  await redirectIfMissingPlanFeature("tasks", "/tasks");
  const [auth, tasks] = await Promise.all([
    requirePermission("tasks:read"),
    listTasks(),
  ]);

  return <TasksView tasks={tasks} role={auth.role as AppUserRole} />;
}

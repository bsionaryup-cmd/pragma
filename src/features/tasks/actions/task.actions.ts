"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  taskFormSchema,
  type TaskFormValues,
} from "@/features/tasks/schemas/task.schema";
import { requirePermission } from "@/lib/auth";
import { createTask, updateTaskStatus } from "@/services/tasks/task.service";
import {
  getCategorySlugForTaskType,
  isTaskCategorySlug,
} from "@/lib/tasks/task-categories";

export async function createTaskAction(data: TaskFormValues) {
  const user = await requirePermission("tasks:write");
  const parsed = taskFormSchema.parse(data);
  await createTask(user.dbUserId, parsed);
  const slug = getCategorySlugForTaskType(parsed.type);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${slug}`);
  redirect(`/tasks/${slug}`);
}

export async function updateTaskStatusAction(
  id: string,
  status: TaskFormValues["status"],
  categorySlug?: string,
) {
  await requirePermission("tasks:write");
  await updateTaskStatus(id, status);
  revalidatePath("/tasks");
  if (categorySlug && isTaskCategorySlug(categorySlug)) {
    revalidatePath(`/tasks/${categorySlug}`);
  }
}

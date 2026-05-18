"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  taskFormSchema,
  type TaskFormValues,
} from "@/features/tasks/schemas/task.schema";
import { requirePermission } from "@/lib/auth";
import { createTask, updateTaskStatus } from "@/services/tasks/task.service";

export async function createTaskAction(data: TaskFormValues) {
  const user = await requirePermission("tasks:write");
  const parsed = taskFormSchema.parse(data);
  await createTask(user.dbUserId, parsed);
  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function updateTaskStatusAction(
  id: string,
  status: TaskFormValues["status"],
) {
  await requirePermission("tasks:write");
  await updateTaskStatus(id, status);
  revalidatePath("/tasks");
}

"use server";

import { TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  taskFormSchema,
  type TaskFormValues,
} from "@/features/tasks/schemas/task.schema";
import { requirePermission } from "@/lib/auth";
import { createTask, deleteTask, updateTask, updateTaskStatus } from "@/services/tasks/task.service";

export async function createTaskAction(data: TaskFormValues) {
  const user = await requirePermission("tasks:write");
  const parsed = taskFormSchema.parse(data);
  await createTask(user.dbUserId, parsed);
  revalidatePath("/tasks");
}

export async function toggleTaskCompletedAction(id: string, completed: boolean) {
  await requirePermission("tasks:write");
  await updateTaskStatus(
    id,
    completed ? TaskStatus.COMPLETED : TaskStatus.PENDING,
  );
  revalidatePath("/tasks");
}

export async function updateTaskAction(id: string, data: TaskFormValues) {
  await requirePermission("tasks:write");
  const parsed = taskFormSchema.parse(data);
  await updateTask(id, parsed);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/edit/${id}`);
}

export async function deleteTaskAction(id: string) {
  await requirePermission("tasks:write");
  await deleteTask(id);
  revalidatePath("/tasks");
}

import { TaskStatus, TaskType } from "@prisma/client";
import type { TaskFormValues } from "@/features/tasks/schemas/task.schema";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { taskWhere } from "@/lib/platform/tenant-data-scope";

const DEFAULT_TASK_TYPE = TaskType.MAINTENANCE;

export async function listTasks() {
  const scope = await requireTenantDataScope();
  return db.task.findMany({
    where: taskWhere(scope),
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function createTask(assigneeId: string, data: TaskFormValues) {
  await requireTenantDataScope();

  return db.task.create({
    data: {
      type: DEFAULT_TASK_TYPE,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status: TaskStatus.PENDING,
      assigneeId,
    },
  });
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const scope = await requireTenantDataScope();
  const task = await db.task.findFirst({
    where: { id, ...taskWhere(scope) },
    select: { id: true },
  });

  if (!task) {
    throw new Error("Tarea no encontrada");
  }

  return db.task.update({
    where: { id },
    data: {
      status,
      completedAt: status === TaskStatus.COMPLETED ? new Date() : null,
    },
  });
}

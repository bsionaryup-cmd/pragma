import { TaskStatus, TaskType, type Prisma } from "@prisma/client";
import type { TaskFormValues } from "@/features/tasks/schemas/task.schema";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  propertyWhere,
  reservationPropertyWhere,
  taskWhere,
  type TenantDataScope,
} from "@/lib/platform/tenant-data-scope";

const DEFAULT_TASK_TYPE = TaskType.MAINTENANCE;
const EMAIL_TASK_ID_PREFIX = "email:";

const TASK_STATUS_SORT_ORDER: Record<TaskStatus, number> = {
  PENDING: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

export type TaskListRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: Date;
  source: "manual" | "email";
};

function airbnbEmailTaskWhere(
  scope: TenantDataScope,
): Prisma.AirbnbEmailTaskWhereInput {
  return {
    OR: [
      { reservation: reservationPropertyWhere(scope) },
      { property: propertyWhere(scope) },
    ],
  };
}

function sortTaskRows(rows: TaskListRow[]): TaskListRow[] {
  return [...rows].sort((left, right) => {
    const statusDelta =
      TASK_STATUS_SORT_ORDER[left.status] - TASK_STATUS_SORT_ORDER[right.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }
    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

export async function listTasks(): Promise<TaskListRow[]> {
  const scope = await requireTenantDataScope();
  const [manualTasks, emailTasks] = await Promise.all([
    db.task.findMany({
      where: taskWhere(scope),
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
      },
    }),
    db.airbnbEmailTask.findMany({
      where: airbnbEmailTaskWhere(scope),
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return sortTaskRows([
    ...manualTasks.map((task) => ({
      ...task,
      source: "manual" as const,
    })),
    ...emailTasks.map((task) => ({
      id: `${EMAIL_TASK_ID_PREFIX}${task.id}`,
      title: task.title,
      description: task.description,
      status: task.status,
      createdAt: task.createdAt,
      source: "email" as const,
    })),
  ]);
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

export async function getTaskById(id: string) {
  const scope = await requireTenantDataScope();
  return db.task.findFirst({
    where: { id, ...taskWhere(scope) },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function updateTask(id: string, data: TaskFormValues) {
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
      title: data.title.trim(),
      description: data.description?.trim() || null,
    },
  });
}

export async function deleteTask(id: string) {
  const scope = await requireTenantDataScope();
  const task = await db.task.findFirst({
    where: { id, ...taskWhere(scope) },
    select: { id: true },
  });

  if (!task) {
    throw new Error("Tarea no encontrada");
  }

  return db.task.delete({ where: { id } });
}

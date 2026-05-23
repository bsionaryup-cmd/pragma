import type { TaskFormValues } from "@/features/tasks/schemas/task.schema";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  assertPropertyInScope,
  assertReservationInScope,
} from "@/lib/platform/tenant-access";
import { taskWhere } from "@/lib/platform/tenant-data-scope";

export async function listTasks() {
  const scope = await requireTenantDataScope();
  return db.task.findMany({
    where: taskWhere(scope),
    include: {
      property: { select: { name: true } },
      assignee: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}

export async function createTask(assigneeId: string, data: TaskFormValues) {
  const scope = await requireTenantDataScope();

  if (data.propertyId) {
    await assertPropertyInScope(scope, data.propertyId);
  }

  if (data.reservationId) {
    await assertReservationInScope(scope, data.reservationId);
  }

  return db.task.create({
    data: {
      type: data.type,
      title: data.title,
      description: data.description || null,
      status: data.status,
      propertyId: data.propertyId || null,
      reservationId: data.reservationId || null,
      assigneeId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  });
}

export async function updateTaskStatus(
  id: string,
  status: TaskFormValues["status"],
) {
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
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
}

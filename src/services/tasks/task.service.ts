import type { TaskFormValues } from "@/features/tasks/schemas/task.schema";
import { db } from "@/lib/db";

export async function listTasks() {
  return db.task.findMany({
    include: {
      property: { select: { name: true } },
      assignee: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}

export async function createTask(assigneeId: string, data: TaskFormValues) {
  if (data.propertyId) {
    const property = await db.property.findFirst({
      where: { id: data.propertyId },
    });
    if (!property) throw new Error("Propiedad no válida");
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
  return db.task.update({
    where: { id },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
}

import { TaskStatus, TaskType } from "@prisma/client";
import { z } from "zod";

export const taskFormSchema = z.object({
  propertyId: z.string().optional(),
  reservationId: z.string().optional(),
  type: z.nativeEnum(TaskType),
  title: z.string().min(2),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.nativeEnum(TaskStatus),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

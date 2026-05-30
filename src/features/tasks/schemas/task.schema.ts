import { z } from "zod";

export const taskFormSchema = z.object({
  title: z.string().min(2, "El título es obligatorio"),
  description: z.string().optional(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

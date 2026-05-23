import { UserRole } from "@prisma/client";
import { z } from "zod";

export const createUserSchema = z
  .object({
    email: z.string().email("Email inválido"),
    firstName: z.string().trim().max(80).optional().or(z.literal("")),
    lastName: z.string().trim().max(80).optional().or(z.literal("")),
    role: z.nativeEnum(UserRole),
    password: z.string().min(1, "Contraseña requerida"),
    confirmPassword: z.string().min(1, "Confirma la contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type CreateUserValues = z.infer<typeof createUserSchema>;

export const updateUserProfileSchema = z.object({
  firstName: z.string().trim().max(80).optional().or(z.literal("")),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
});

export type UpdateUserProfileValues = z.infer<typeof updateUserProfileSchema>;

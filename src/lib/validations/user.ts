import { z } from "zod";

export const clerkUserPayloadSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  imageUrl: z
    .string()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

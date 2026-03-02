import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const updateProfileSchema = z.object({
  firstName: optionalTrimmed,
  lastName: optionalTrimmed,
  phone: z
    .string()
    .trim()
    .min(6)
    .max(30)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const upsertAddressSchema = z.object({
  label: z.string().trim().max(80).optional(),
  country: z.string().trim().min(2).max(80).default("Россия"),
  city: z.string().trim().min(2).max(120),
  street: z.string().trim().min(2).max(120),
  house: z.string().trim().min(1).max(40),
  apartment: z.string().trim().max(40).optional(),
  postalCode: z.string().trim().max(20).optional(),
  comment: z.string().trim().max(300).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const changeRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8, "Новый пароль должен быть не короче 8 символов"),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Подтверждение пароля не совпадает",
    path: ["confirmPassword"],
  });

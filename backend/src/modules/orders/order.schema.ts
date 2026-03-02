import { z } from "zod";

export const orderItemInputSchema = z.object({
  productId: z.string().min(1),
  qty: z.coerce.number().int().positive().max(99),
  size: z.string().trim().max(20).optional(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemInputSchema).min(1),
});

export const orderParamsSchema = z.object({
  orderId: z.string().min(1),
});

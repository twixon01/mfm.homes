import { z } from "zod";

export const wishlistProductParamsSchema = z.object({
  productId: z.string().min(1),
});

export const addWishlistItemSchema = z.object({
  productId: z.string().min(1),
});

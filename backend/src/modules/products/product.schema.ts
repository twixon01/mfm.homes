import { z } from "zod";

export const productCategorySchema = z.enum(["TOPS", "OUTER", "BOTTOMS", "OTHER"]);
export const productConditionSchema = z.enum(["NEW", "USED"]);
export const productSourceTypeSchema = z.enum(["INTERNAL", "EXTERNAL"]);

export const listProductsQuerySchema = z.object({
  q: z.string().trim().optional(),
  category: productCategorySchema.optional(),
  includeInactive: z.coerce.boolean().optional().default(false),
});

export const productParamsSchema = z.object({
  productId: z.string().min(1),
});

const baseProductSchema = z.object({
  name: z.string().trim().min(2).max(200),
  brand: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(5000),
  priceRub: z.coerce.number().int().nonnegative(),
  category: productCategorySchema,
  sizes: z.array(z.string().trim().min(1).max(20)).min(1),
  condition: productConditionSchema,
  sourceType: productSourceTypeSchema,
  sourceName: z.string().trim().min(1).max(120),
  sourceUrl: z.url().optional().nullable(),
  images: z.array(z.string().trim().min(1)).default([]),
  isActive: z.boolean().optional().default(true),
});

export const createProductSchema = baseProductSchema;
export const updateProductSchema = baseProductSchema.partial();

import type { Product } from "../types/domain";

function slugify(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "product";
}

export function getProductHref(product: Pick<Product, "id" | "name" | "brand">) {
  const slug = slugify(`${product.brand} ${product.name}`);
  return `/product/${slug}?id=${encodeURIComponent(product.id)}`;
}

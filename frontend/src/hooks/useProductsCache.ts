import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "../lib/http";
import type { CartItem, Product, ProductsListResponse } from "../types/domain";

type UseProductsCacheOptions = {
  cart: CartItem[];
  wishlistProductIds: string[];
};

export function useProductsCache({ cart, wishlistProductIds }: UseProductsCacheOptions) {
  const [products, setProducts] = useState<Product[]>([]);

  const cacheProducts = useCallback((items: Product[]) => {
    setProducts((prev) => {
      const map = new Map(prev.map((item) => [item.id, item]));
      for (const item of items) map.set(item.id, item);
      return Array.from(map.values());
    });
  }, []);

  const loadInitialProductsCache = useCallback(async () => {
    const firstPage = await apiRequest<ProductsListResponse>("/api/products?page=1&limit=30");
    cacheProducts(firstPage.products);

    const prefetchUntil = Math.min(5, firstPage.pagination.totalPages);
    for (let page = 2; page <= prefetchUntil; page += 1) {
      void apiRequest<ProductsListResponse>(`/api/products?page=${page}&limit=30`)
        .then((response) => cacheProducts(response.products))
        .catch(() => undefined);
    }
  }, [cacheProducts]);

  useEffect(() => {
    const requiredIds = Array.from(new Set([...cart.map((item) => item.productId), ...wishlistProductIds]));
    const knownIds = new Set(products.map((product) => product.id));
    const missingIds = requiredIds.filter((id) => !knownIds.has(id));
    if (missingIds.length === 0) return;

    void Promise.all(
      missingIds.map((productId) =>
        apiRequest<{ product: Product }>(`/api/products/${productId}`)
          .then((data) => data.product)
          .catch(() => null),
      ),
    ).then((loadedProducts) => {
      const available = loadedProducts.filter((item): item is Product => Boolean(item));
      if (available.length > 0) cacheProducts(available);
    });
  }, [cart, wishlistProductIds, products, cacheProducts]);

  return {
    products,
    cacheProducts,
    loadInitialProductsCache,
  };
}

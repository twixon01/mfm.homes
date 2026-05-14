import { useState } from "react";

import { apiRequest, getAuthHeaders } from "../lib/http";
import { GUEST_WISHLIST_KEY, readWishlist, writeWishlist } from "../lib/storage";
import type { User, WishlistApiItem } from "../types/domain";

type UseWishlistOptions = {
  user: User | null;
};

export function useWishlist({ user }: UseWishlistOptions) {
  const [wishlistProductIds, setWishlistProductIds] = useState<string[]>([]);

  async function loadWishlist(currentUser: User | null = user) {
    if (!currentUser) {
      setWishlistProductIds(readWishlist(GUEST_WISHLIST_KEY));
      return;
    }
    const data = await apiRequest<{ wishlist: WishlistApiItem[] }>("/api/wishlist", {
      headers: getAuthHeaders(),
    });
    setWishlistProductIds(Array.from(new Set(data.wishlist.map((item) => item.productId))));
  }

  async function mergeGuestWishlistToUser(productIds: string[]) {
    if (productIds.length === 0) return;
    await Promise.all(
      productIds.map((productId) =>
        apiRequest<{ success: boolean }>("/api/wishlist", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ productId }),
        }).catch(() => null),
      ),
    );
  }

  function applyGuestWishlist() {
    setWishlistProductIds(readWishlist(GUEST_WISHLIST_KEY));
  }

  async function applyAuthWishlist(currentUser: User) {
    const guestWishlist = readWishlist(GUEST_WISHLIST_KEY);
    await mergeGuestWishlistToUser(guestWishlist);
    localStorage.removeItem(GUEST_WISHLIST_KEY);
    await loadWishlist(currentUser);
  }

  async function handleAddToWishlist(productId: string) {
    if (!user) {
      setWishlistProductIds((prev) => {
        if (prev.includes(productId)) return prev;
        const next = [...prev, productId];
        writeWishlist(GUEST_WISHLIST_KEY, next);
        return next;
      });
      return;
    }

    await apiRequest<{ success: boolean }>("/api/wishlist", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ productId }),
    });
    await loadWishlist(user);
  }

  async function handleRemoveFromWishlist(productId: string) {
    if (!user) {
      setWishlistProductIds((prev) => {
        const next = prev.filter((id) => id !== productId);
        writeWishlist(GUEST_WISHLIST_KEY, next);
        return next;
      });
      return;
    }

    await apiRequest<{ success: boolean }>(`/api/wishlist/${productId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    await loadWishlist(user);
  }

  return {
    wishlistProductIds,
    loadWishlist,
    applyGuestWishlist,
    applyAuthWishlist,
    handleAddToWishlist,
    handleRemoveFromWishlist,
  };
}

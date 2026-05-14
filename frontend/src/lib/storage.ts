import type { CartItem } from "../types/domain";

export const GUEST_CART_KEY = "mfm_cart_guest";
export const GUEST_WISHLIST_KEY = "mfm_wishlist_guest";

export function getUserCartKey(userId: string) {
  return `mfm_cart_user_${userId}`;
}

export function getSelectedAddressStorageKey(userId: string) {
  return `mfm_selected_address_${userId}`;
}

export function readCart(key: string): CartItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(key: string, items: CartItem[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export function readWishlist(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter((value): value is string => typeof value === "string" && value.length > 0)));
  } catch {
    return [];
  }
}

export function writeWishlist(key: string, productIds: string[]) {
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(productIds))));
}

export function mergeCarts(primary: CartItem[], secondary: CartItem[]) {
  const map = new Map<string, CartItem>();
  for (const item of [...primary, ...secondary]) {
    const key = `${item.productId}__${item.size}`;
    const existing = map.get(key);
    if (existing) existing.qty += item.qty;
    else map.set(key, { ...item });
  }
  return Array.from(map.values()).filter((item) => item.qty > 0);
}

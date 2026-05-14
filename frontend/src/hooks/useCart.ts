import { useEffect, useState } from "react";

import { apiRequest, getAuthHeaders } from "../lib/http";
import {
  getSelectedAddressStorageKey,
  getUserCartKey,
  GUEST_CART_KEY,
  mergeCarts,
  readCart,
  writeCart,
} from "../lib/storage";
import type { CartItem, Order, User } from "../types/domain";

type UseCartOptions = {
  user: User | null;
  bootstrapping: boolean;
  pathname: string;
};

export function useCart({ user, bootstrapping, pathname }: UseCartOptions) {
  const [cart, setCart] = useState<CartItem[]>([]);

  function getPendingCheckoutKey(userId: string) {
    return `mfm_pending_checkout_order_${userId}`;
  }

  function applyGuestCart() {
    setCart(readCart(GUEST_CART_KEY));
  }

  function applyAuthCart(userId: string) {
    const userCart = readCart(getUserCartKey(userId));
    const guestCart = readCart(GUEST_CART_KEY);
    const merged = mergeCarts(userCart, guestCart);
    setCart(merged);
    writeCart(getUserCartKey(userId), merged);
    localStorage.removeItem(GUEST_CART_KEY);
  }

  function handleAddToBag(productId: string, size: string) {
    setCart((prev) => {
      const next = [...prev];
      const idx = next.findIndex((item) => item.productId === productId && item.size === size);
      if (idx >= 0) next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      else next.push({ productId, size, qty: 1 });
      return next;
    });
  }

  function handleDecreaseCartQty(productId: string, size: string) {
    setCart((prev) => {
      const next = [...prev];
      const idx = next.findIndex((item) => item.productId === productId && item.size === size);
      if (idx < 0) return prev;
      if (next[idx].qty <= 1) next.splice(idx, 1);
      else next[idx] = { ...next[idx], qty: next[idx].qty - 1 };
      return next;
    });
  }

  async function handleCheckout(addressId: string) {
    if (!user) return null;
    if (cart.length === 0) throw new Error("Корзина пустая");

    const orderData = await apiRequest<{ order: Order }>("/api/orders", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ items: cart, addressId }),
    });

    const pendingCheckoutKey = getPendingCheckoutKey(user.id);
    localStorage.setItem(pendingCheckoutKey, orderData.order.id);

    try {
      const payData = await apiRequest<{ confirmationUrl: string | null }>(`/api/orders/${orderData.order.id}/pay`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      return payData.confirmationUrl;
    } catch (error) {
      localStorage.removeItem(pendingCheckoutKey);
      throw error;
    }
  }

  async function handleQuickBuy(productId: string, size: string) {
    if (!user) return null;
    const addressId = localStorage.getItem(getSelectedAddressStorageKey(user.id));
    if (!addressId) {
      throw new Error("Сначала выберите адрес доставки в bag перед quick buy");
    }

    const orderData = await apiRequest<{ order: Order }>("/api/orders", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ items: [{ productId, qty: 1, size }], addressId }),
    });

    const payData = await apiRequest<{ confirmationUrl: string | null }>(`/api/orders/${orderData.order.id}/pay`, {
      method: "POST",
      headers: getAuthHeaders(),
    });

    return payData.confirmationUrl;
  }

  useEffect(() => {
    if (bootstrapping) return;
    if (user) writeCart(getUserCartKey(user.id), cart);
    else writeCart(GUEST_CART_KEY, cart);
  }, [bootstrapping, cart, user]);

  useEffect(() => {
    if (bootstrapping || !user || pathname !== "/orders") return;
    const trackingKey = getPendingCheckoutKey(user.id);
    const pendingOrderId = localStorage.getItem(trackingKey);
    if (!pendingOrderId) return;

    let cancelled = false;
    const terminalStatuses = new Set(["SUCCEEDED", "CANCELED", "FAILED"]);

    async function checkPendingOrderStatus() {
      try {
        const data = await apiRequest<{ order: Order }>(`/api/orders/${pendingOrderId}`, {
          headers: getAuthHeaders(),
        });
        if (cancelled) return;

        if (data.order.paymentStatus === "SUCCEEDED") {
          setCart([]);
        }
        if (terminalStatuses.has(data.order.paymentStatus)) {
          localStorage.removeItem(trackingKey);
        }
      } catch {
        if (!cancelled) localStorage.removeItem(trackingKey);
      }
    }

    void checkPendingOrderStatus();
    const pollId = window.setInterval(() => {
      void checkPendingOrderStatus();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [bootstrapping, user, pathname]);

  return {
    cart,
    applyGuestCart,
    applyAuthCart,
    handleAddToBag,
    handleDecreaseCartQty,
    handleCheckout,
    handleQuickBuy,
  };
}

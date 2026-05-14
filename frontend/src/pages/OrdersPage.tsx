import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { TopNav } from "../components/navigation/TopNav";
import { apiRequest, getAuthHeaders } from "../lib/http";
import { formatPrice } from "../lib/ui";
import type { Order, User } from "../types/domain";

type OrdersPageProps = {
  user: User | null;
  bagCount: number;
  wishlistCount: number;
};

export function OrdersPage({ user, bagCount, wishlistCount }: OrdersPageProps) {
  const accountHref = user ? "/account" : "/login";
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState("");
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  async function loadOrders() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{ orders: Order[] }>("/api/orders", {
        headers: getAuthHeaders(),
      });
      setOrders(data.orders);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, [user?.id]);

  async function payOrder(orderId: string) {
    setPayingOrderId(orderId);
    setError("");
    try {
      const data = await apiRequest<{ confirmationUrl: string | null }>(`/api/orders/${orderId}/pay`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (data.confirmationUrl) {
        window.location.assign(data.confirmationUrl);
        return;
      }
      await loadOrders();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось создать платеж");
    } finally {
      setPayingOrderId(null);
    }
  }

  return (
    <main className="account-page">
      <section className="account-shell">
        <TopNav accountHref={accountHref} bagCount={bagCount} wishlistCount={wishlistCount} isAdmin={user?.role === "ADMIN"} />
        <h1>Orders</h1>
        {!user ? (
          <p className="account-subtitle">
            Нужно <Link to="/login">войти</Link>, чтобы увидеть заказы.
          </p>
        ) : null}
        {error ? <p className="admin-error">{error}</p> : null}
        {loading ? <p className="account-subtitle">Загружаем заказы...</p> : null}
        {!loading && user && orders.length === 0 ? <p className="account-subtitle">Заказов пока нет.</p> : null}
        {!loading && orders.length > 0 ? (
          <section className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-card-top">
                  <p>
                    <strong>Order:</strong> {order.id}
                  </p>
                  <p>
                    <strong>Status:</strong> {order.status} / {order.paymentStatus}
                  </p>
                </div>
                <p className="order-total">Total: {formatPrice(order.totalRub)}</p>
                <div className="order-items-preview">
                  <span>
                    {order.deliveryLabel ? `${order.deliveryLabel} — ` : ""}
                    {order.deliveryCountry}, {order.deliveryCity}, {order.deliveryStreet}, {order.deliveryHouse}
                    {order.deliveryApartment ? `, кв. ${order.deliveryApartment}` : ""}
                  </span>
                  {order.deliveryPostalCode ? <span>Индекс: {order.deliveryPostalCode}</span> : null}
                  {order.deliveryComment ? <span>{order.deliveryComment}</span> : null}
                </div>
                <div className="order-items-preview">
                  {order.items.slice(0, 3).map((item) => (
                    <span key={item.id}>
                      {item.brand ?? "Brand"} {item.nameSnapshot} x{item.qty}
                    </span>
                  ))}
                </div>
                {order.paymentStatus === "PENDING" ? (
                  <div className="account-actions">
                    <button
                      type="button"
                      onClick={() => payOrder(order.id)}
                      disabled={payingOrderId === order.id}
                    >
                      {payingOrderId === order.id ? "Создаем платеж..." : "Оплатить"}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}
      </section>
    </main>
  );
}

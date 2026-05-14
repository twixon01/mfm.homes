import { useEffect, useState } from "react";

import { AdminSectionNav } from "../../components/navigation/AdminSectionNav";
import { TopNav } from "../../components/navigation/TopNav";
import { apiRequest, getAuthHeaders } from "../../lib/http";
import { formatDateTime, formatPrice, isTerminalOrderStatus } from "../../lib/ui";
import type { AdminOrder } from "../../types/domain";

type AdminOrdersPageProps = {
  bagCount: number;
  wishlistCount: number;
};

export function AdminOrdersPage({ bagCount, wishlistCount }: AdminOrdersPageProps) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [includeOpen, setIncludeOpen] = useState(true);

  async function loadAdminOrders() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        sort,
        includeCompleted: String(includeCompleted),
        includeOpen: String(includeOpen),
      });
      const data = await apiRequest<{ orders: AdminOrder[] }>(`/api/admin/orders?${params.toString()}`, {
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
    void loadAdminOrders();
  }, [sort, includeCompleted, includeOpen]);

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <TopNav accountHref="/account" bagCount={bagCount} wishlistCount={wishlistCount} isAdmin />
        <AdminSectionNav current="orders" />

        <div className="admin-filters">
          <label>
            sort
            <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "oldest")}>
              <option value="newest">newest first</option>
              <option value="oldest">oldest first</option>
            </select>
          </label>
          <label className="admin-check-row">
            <input
              type="checkbox"
              checked={includeOpen}
              onChange={(e) => setIncludeOpen(e.target.checked)}
            />
            unfinished
          </label>
          <label className="admin-check-row">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
            />
            completed
          </label>
        </div>

        {error ? <p className="admin-error">{error}</p> : null}
        {loading ? <p>Loading...</p> : null}
        {!loading && orders.length === 0 ? <p className="account-subtitle">Заказы по текущим фильтрам не найдены.</p> : null}

        {!loading && orders.length > 0 ? (
          <section className="admin-orders-list">
            {orders.map((order) => (
              <article key={order.id} className="admin-order-card">
                <div className="admin-order-top">
                  <div>
                    <p className="title">Order {order.id}</p>
                    {order.user.firstName || order.user.lastName ? (
                      <>
                        <p className="meta">{`${order.user.firstName ?? ""} ${order.user.lastName ?? ""}`.trim()}</p>
                        <p className="meta">{order.user.email}</p>
                      </>
                    ) : (
                      <p className="meta">{order.user.email}</p>
                    )}
                  </div>
                  <div>
                    <p className="meta">Created: {formatDateTime(order.createdAt)}</p>
                    <p className="meta">
                      Status: {order.status} / {order.paymentStatus}
                      {isTerminalOrderStatus(order.status) ? " · completed" : " · unfinished"}
                    </p>
                    <p className="meta">Total: {formatPrice(order.totalRub)}</p>
                  </div>
                </div>
                <p className="meta admin-order-address">
                  Delivery: {order.deliveryLabel ? `${order.deliveryLabel} — ` : ""}
                  {order.deliveryCountry}, {order.deliveryCity}, {order.deliveryStreet}, {order.deliveryHouse}
                  {order.deliveryApartment ? `, кв. ${order.deliveryApartment}` : ""}
                  {order.deliveryPostalCode ? `, ${order.deliveryPostalCode}` : ""}
                </p>
                {order.deliveryComment ? <p className="meta">{order.deliveryComment}</p> : null}
                <div className="order-items-preview">
                  {order.items.map((item) => (
                    <span key={item.id}>
                      {item.brand ?? "Brand"} {item.nameSnapshot} x{item.qty}
                      {item.size ? ` · ${item.size}` : ""}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </section>
    </main>
  );
}

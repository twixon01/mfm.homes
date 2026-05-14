import { Link } from "react-router-dom";

type AdminSectionNavProps = {
  current: "products" | "orders";
};

export function AdminSectionNav({ current }: AdminSectionNavProps) {
  return (
    <div className="admin-section-nav">
      <Link to="/admin/products" className={current === "products" ? "active" : ""}>
        products
      </Link>
      <Link to="/admin/orders" className={current === "orders" ? "active" : ""}>
        orders
      </Link>
    </div>
  );
}

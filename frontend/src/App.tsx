import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import homeBackground from "./assets/HOME.png";

type Role = "USER" | "ADMIN";
type Category = "TOPS" | "OUTER" | "BOTTOMS" | "OTHER";
type SourceType = "INTERNAL" | "EXTERNAL";

type User = {
  id: string;
  email: string;
  role: Role;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

type Product = {
  id: string;
  name: string;
  brand: string;
  description: string;
  priceRub: number;
  category: Category;
  sizes: string[];
  condition: "NEW" | "USED";
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string | null;
  images: string[];
  isActive: boolean;
};

type CartItem = {
  productId: string;
  size: string;
  qty: number;
};

type OrderStatus = "CREATED" | "AWAITING_PAYMENT" | "PAID" | "PROCESSING" | "SHIPPED" | "COMPLETED" | "CANCELLED";
type PaymentStatus = "PENDING" | "SUCCEEDED" | "CANCELED" | "FAILED";

type OrderItem = {
  id: string;
  nameSnapshot: string;
  priceRub: number;
  qty: number;
  size: string | null;
  brand: string | null;
  imageUrl: string | null;
};

type Order = {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalRub: number;
  shippingRub: number;
  totalRub: number;
  createdAt: string;
  items: OrderItem[];
};

type ProductFormState = {
  name: string;
  brand: string;
  description: string;
  priceRub: string;
  category: Category;
  sizesText: string;
  condition: "NEW" | "USED";
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  imagesText: string;
  isActive: boolean;
};

const TOKEN_KEY = "mfm_token";
const GUEST_CART_KEY = "mfm_cart_guest";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getUserCartKey(userId: string) {
  return `mfm_cart_user_${userId}`;
}

function readCart(key: string): CartItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(key: string, items: CartItem[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

function mergeCarts(primary: CartItem[], secondary: CartItem[]) {
  const map = new Map<string, CartItem>();
  for (const item of [...primary, ...secondary]) {
    const key = `${item.productId}__${item.size}`;
    const existing = map.get(key);
    if (existing) existing.qty += item.qty;
    else map.set(key, { ...item });
  }
  return Array.from(map.values()).filter((item) => item.qty > 0);
}

function categoryClass(category: Category) {
  return category.toLowerCase();
}

function visualStyle(imageUrl?: string) {
  if (!imageUrl) return undefined;
  return {
    backgroundImage: `url("${encodeURI(imageUrl)}")`,
    backgroundSize: "contain",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  } as const;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null;
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : "Ошибка запроса";
    throw new Error(message);
  }

  return payload as T;
}

function formatPrice(value: number) {
  return value.toLocaleString("ru-RU");
}

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function TopNav({
  accountHref,
  bagCount,
  isAdmin,
}: {
  accountHref: string;
  bagCount: number;
  isAdmin?: boolean;
}) {
  return (
    <header className="app-top-nav">
      <nav className="catalog-nav">
        [<Link to={accountHref}>account</Link> / <Link to="/bag">bag ({bagCount})</Link> / <Link to="/">search</Link>
        {isAdmin ? <> / <Link to="/admin/products">admin</Link></> : null}]
      </nav>
    </header>
  );
}

function LoginPage({ onAuth }: { onAuth: (token: string, user: User) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(mode: "login" | "register", e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onAuth(data.token, data.user);
      navigate("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ошибка");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-page" style={{ backgroundImage: `url(${homeBackground})` }}>
      <section className="login-card">
        <div className="login-panel">
          <h1>Войдите для покупок на mfm.homes</h1>
          <p className="subtitle">Поиск и заказ вещей в одном месте.</p>
          <form className="login-form" onSubmit={(e) => submit("login", e)}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              placeholder="Минимум 8 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <div className="login-actions">
              <button type="submit" disabled={isLoading}>
                {isLoading ? "Входим..." : "Войти"}
              </button>
              <button type="button" className="secondary" disabled={isLoading} onClick={(e) => submit("register", e)}>
                Зарегистрироваться
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function CatalogPage({
  user,
  bagCount,
  products,
  loading,
}: {
  user: User | null;
  bagCount: number;
  products: Product[];
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"ALL" | Category>("ALL");
  const accountHref = user ? "/account" : "/login";

  const items = useMemo(() => {
    return products.filter((item) => {
      const byCategory = category === "ALL" || item.category === category;
      const q = query.trim().toLowerCase();
      const byQuery = !q || `${item.brand} ${item.name}`.toLowerCase().includes(q);
      return byCategory && byQuery;
    });
  }, [products, category, query]);

  return (
    <main className="catalog-page">
      <section className="catalog-shell">
        <TopNav accountHref={accountHref} bagCount={bagCount} isAdmin={user?.role === "ADMIN"} />
        <header className="catalog-topbar">
          <label className="catalog-search">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="typing..." aria-label="Поиск" />
          </label>
        </header>

        <section className="catalog-content">
          <aside className="catalog-filters">
            <strong>FILTERS:</strong>
            <button type="button" onClick={() => setCategory("TOPS")}>
              ./TOPS
            </button>
            <button type="button" onClick={() => setCategory("OTHER")}>
              ./OTHER
            </button>
            <button type="button" onClick={() => setCategory("BOTTOMS")}>
              ./BOTTOMS
            </button>
            <button type="button" onClick={() => setCategory("OUTER")}>
              ./OUTER
            </button>
            <button type="button" onClick={() => setCategory("ALL")}>
              ./ALL
            </button>
          </aside>

          <div className="catalog-grid-wrap">
            {loading ? (
              <p>Загружаем каталог...</p>
            ) : (
              <div className="catalog-grid">
                {items.map((item) => (
                  <Link key={item.id} to={`/product/${item.id}`} className="product-card-link">
                    <article className="product-card">
                      <div
                        className={`product-image ${categoryClass(item.category)}`}
                        style={visualStyle(item.images[0])}
                      ></div>
                      <p className="brand">{item.brand}</p>
                      <p className="name">{item.name}</p>
                      <p className="price">{formatPrice(item.priceRub)}</p>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function ProductPage({
  user,
  products,
  onAddToBag,
  bagCount,
}: {
  user: User | null;
  products: Product[];
  onAddToBag: (productId: string, size: string) => void;
  bagCount: number;
}) {
  const { id } = useParams();
  const item = products.find((product) => product.id === id);
  const [size, setSize] = useState(item?.sizes?.[0] ?? "ONE SIZE");
  const accountHref = user ? "/account" : "/login";

  useEffect(() => {
    if (item?.sizes?.length) setSize(item.sizes[0]);
  }, [item?.id]);

  if (!item) return <Navigate to="/" replace />;

  return (
    <main className="product-page">
      <section className="product-shell">
        <TopNav accountHref={accountHref} bagCount={bagCount} isAdmin={user?.role === "ADMIN"} />

        <section className="product-main">
          <div className="product-visual-wrap">
            <div
              className={`product-image product-detail-image ${categoryClass(item.category)}`}
              style={visualStyle(item.images[0])}
            ></div>
          </div>

          <div className="product-detail">
            <h2>{item.brand}</h2>
            <p className="title">{item.name}</p>
            <p className={`source-badge ${item.sourceType === "INTERNAL" ? "internal" : "external"}`}>
              {item.sourceType === "INTERNAL"
                ? `Источник: ${item.sourceName}`
                : `Источник: внешний (${item.sourceName})`}
            </p>

            <label htmlFor="size-select">Size</label>
            <select id="size-select" value={size} onChange={(e) => setSize(e.target.value)}>
              {(item.sizes.length ? item.sizes : ["ONE SIZE"]).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <p className="total-price">Total price incl.shipping: {formatPrice(item.priceRub)}</p>

            <div className="product-actions">
              <button type="button" className="primary" onClick={() => onAddToBag(item.id, size)}>
                ADD TO BAG
              </button>
              <button type="button" className="secondary">
                QUICK BUY
              </button>
              <button type="button" className="wishlist">
                ADD TO WISHLIST
              </button>
            </div>
          </div>
        </section>

        <section className="product-description">
          <h3>Description</h3>
          <p>{item.description}</p>
        </section>
      </section>
    </main>
  );
}

function BagPage({
  user,
  products,
  cart,
  onIncreaseQty,
  onDecreaseQty,
  onCheckout,
}: {
  user: User | null;
  products: Product[];
  cart: CartItem[];
  onIncreaseQty: (productId: string, size: string) => void;
  onDecreaseQty: (productId: string, size: string) => void;
  onCheckout: () => Promise<string | null>;
}) {
  const navigate = useNavigate();
  const accountHref = user ? "/account" : "/login";
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const lines = cart
    .map((row) => {
      const item = products.find((x) => x.id === row.productId);
      if (!item) return null;
      return { row, item, total: row.qty * item.priceRub };
    })
    .filter((x): x is { row: CartItem; item: Product; total: number } => Boolean(x));

  const totalQty = lines.reduce((acc, line) => acc + line.row.qty, 0);
  const subtotal = lines.reduce((acc, line) => acc + line.total, 0);
  const shipping = lines.length > 0 ? 4000 : 0;
  const totalPrice = subtotal + shipping;

  async function handleCheckoutClick() {
    setCheckoutError("");
    if (!user) {
      navigate("/login");
      return;
    }

    setCheckoutLoading(true);
    try {
      const confirmationUrl = await onCheckout();
      if (confirmationUrl) {
        window.location.assign(confirmationUrl);
      } else {
        window.location.assign("/orders");
      }
    } catch (requestError) {
      setCheckoutError(requestError instanceof Error ? requestError.message : "Не удалось начать оплату");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <main className="bag-page">
      <section className="bag-shell">
        <TopNav accountHref={accountHref} bagCount={totalQty} isAdmin={user?.role === "ADMIN"} />

        <h1>Cart</h1>

        {lines.length === 0 ? (
          <section className="bag-empty">
            <p>Корзина пока пустая.</p>
            <Link to="/">Continue shopping</Link>
          </section>
        ) : (
          <section className="bag-layout">
            <div className="bag-left">
              <div className="bag-header">
                <span>Product</span>
                <span>Quantity</span>
                <span>Total</span>
              </div>
              {lines.map((line) => (
                <div className="bag-row" key={`${line.row.productId}-${line.row.size}`}>
                  <div className="bag-product">
                    <div
                      className={`bag-thumb ${categoryClass(line.item.category)}`}
                      style={visualStyle(line.item.images[0])}
                    ></div>
                    <div>
                      <p className="brand">{line.item.brand}</p>
                      <p className="name">{line.item.name}</p>
                      <p className="size">size {line.row.size}</p>
                    </div>
                  </div>

                  <div className="bag-qty">
                    <button type="button" onClick={() => onDecreaseQty(line.row.productId, line.row.size)}>
                      -
                    </button>
                    <span>{line.row.qty}</span>
                    <button type="button" onClick={() => onIncreaseQty(line.row.productId, line.row.size)}>
                      +
                    </button>
                  </div>

                  <p className="bag-line-total">{formatPrice(line.total)}</p>
                </div>
              ))}
            </div>

            <aside className="bag-summary">
              <div className="promo">
                <input type="text" placeholder="Promo code" />
                <button type="button">Apply</button>
              </div>

              <div className="totals">
                <p>
                  <span>Subtotal</span>
                  <strong>{formatPrice(subtotal)}</strong>
                </p>
                <p>
                  <span>Shipping</span>
                  <strong>{formatPrice(shipping)}</strong>
                </p>
                <p>
                  <span>Total (incl.shipping)</span>
                  <strong>{formatPrice(totalPrice)}</strong>
                </p>
              </div>

              <Link to="/" className="continue-link">
                Continue shopping
              </Link>

              <p className="total-final">
                <span>Total</span>
                <strong>{formatPrice(totalPrice)}</strong>
              </p>

              {checkoutError ? <p className="admin-error">{checkoutError}</p> : null}
              <button type="button" className="checkout-btn" onClick={handleCheckoutClick} disabled={checkoutLoading}>
                {checkoutLoading ? "Подготовка платежа..." : "Proceed to Checkout"}
              </button>
            </aside>
          </section>
        )}
      </section>
    </main>
  );
}

const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: "",
  brand: "",
  description: "",
  priceRub: "",
  category: "TOPS",
  sizesText: "S, M, L, XL, XS",
  condition: "NEW",
  sourceType: "INTERNAL",
  sourceName: "MFM",
  sourceUrl: "",
  imagesText: "",
  isActive: true,
};

function normalizeList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function AdminProductsPage({
  bagCount,
  onProductsChanged,
}: {
  bagCount: number;
  onProductsChanged: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);

  const accountHref = "/account";

  async function loadAdminProducts() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{ products: Product[] }>("/api/admin/products?includeInactive=true", {
        headers: getAuthHeaders(),
      });
      setProducts(data.products);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить товары");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminProducts();
  }, []);

  function setField<K extends keyof ProductFormState>(field: K, value: ProductFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setSuccess("");
    setError("");
    setForm({
      name: product.name,
      brand: product.brand,
      description: product.description,
      priceRub: String(product.priceRub),
      category: product.category,
      sizesText: product.sizes.join(", "),
      condition: product.condition,
      sourceType: product.sourceType,
      sourceName: product.sourceName,
      sourceUrl: product.sourceUrl ?? "",
      imagesText: product.images.join("\n"),
      isActive: product.isActive,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_PRODUCT_FORM);
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      description: form.description.trim(),
      priceRub: Number(form.priceRub),
      category: form.category,
      sizes: normalizeList(form.sizesText),
      condition: form.condition,
      sourceType: form.sourceType,
      sourceName: form.sourceName.trim(),
      sourceUrl: form.sourceUrl.trim() ? form.sourceUrl.trim() : null,
      images: normalizeList(form.imagesText),
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await apiRequest<{ product: Product }>(`/api/admin/products/${editingId}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccess("Товар обновлен");
      } else {
        await apiRequest<{ product: Product }>("/api/admin/products", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccess("Товар добавлен");
      }

      await loadAdminProducts();
      await onProductsChanged();
      resetForm();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить товар");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product: Product) {
    setError("");
    setSuccess("");
    try {
      await apiRequest<{ product: Product }>(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      await loadAdminProducts();
      await onProductsChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось изменить статус товара");
    }
  }

  async function deleteProduct(product: Product) {
    const approved = window.confirm(`Удалить товар "${product.name}"?`);
    if (!approved) return;

    setError("");
    setSuccess("");
    try {
      await apiRequest(`/api/admin/products/${product.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      await loadAdminProducts();
      await onProductsChanged();
      if (editingId === product.id) resetForm();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось удалить товар");
    }
  }

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <TopNav accountHref={accountHref} bagCount={bagCount} isAdmin />
        <h1>Add New Product or Update Existing Product</h1>

        {error ? <p className="admin-error">{error}</p> : null}
        {success ? <p className="admin-success">{success}</p> : null}

        <form className="admin-form" onSubmit={submitForm}>
          <input
            placeholder="Brand"
            value={form.brand}
            onChange={(e) => setField("brand", e.target.value)}
            required
          />
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
          />
          <input
            placeholder="Price (RUB)"
            type="number"
            min={0}
            value={form.priceRub}
            onChange={(e) => setField("priceRub", e.target.value)}
            required
          />
          <select value={form.category} onChange={(e) => setField("category", e.target.value as Category)}>
            <option value="TOPS">TOPS</option>
            <option value="OUTER">OUTER</option>
            <option value="BOTTOMS">BOTTOMS</option>
            <option value="OTHER">OTHER</option>
          </select>
          <select value={form.condition} onChange={(e) => setField("condition", e.target.value as "NEW" | "USED")}>
            <option value="NEW">NEW</option>
            <option value="USED">USED</option>
          </select>
          <select
            value={form.sourceType}
            onChange={(e) => setField("sourceType", e.target.value as SourceType)}
          >
            <option value="INTERNAL">INTERNAL</option>
            <option value="EXTERNAL">EXTERNAL</option>
          </select>
          <input
            placeholder="Source name (MFM / eBay ...)"
            value={form.sourceName}
            onChange={(e) => setField("sourceName", e.target.value)}
            required
          />
          <input
            placeholder="Source URL (optional)"
            value={form.sourceUrl}
            onChange={(e) => setField("sourceUrl", e.target.value)}
          />
          <textarea
            placeholder="Sizes: S, M, L, XL, XS"
            value={form.sizesText}
            onChange={(e) => setField("sizesText", e.target.value)}
            rows={2}
          />
          <textarea
            placeholder="Image URLs: each line or comma separated"
            value={form.imagesText}
            onChange={(e) => setField("imagesText", e.target.value)}
            rows={3}
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            rows={4}
            required
          />
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField("isActive", e.target.checked)}
            />
            Active
          </label>

          <div className="admin-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update product" : "Create product"}
            </button>
            {editingId ? (
              <button type="button" className="secondary" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <section className="admin-list">
          <h2>Products ({products.length})</h2>
          {loading ? (
            <p>Loading...</p>
          ) : (
            products.map((product) => (
              <article key={product.id} className="admin-item">
                <div>
                  <p className="title">
                    {product.brand} / {product.name}
                  </p>
                  <p className="meta">
                    {product.category} · {formatPrice(product.priceRub)} RUB · {product.isActive ? "ACTIVE" : "INACTIVE"}
                  </p>
                </div>
                <div className="item-actions">
                  <button type="button" onClick={() => startEdit(product)}>
                    edit
                  </button>
                  <button type="button" onClick={() => toggleActive(product)}>
                    {product.isActive ? "deactivate" : "activate"}
                  </button>
                  <button type="button" onClick={() => deleteProduct(product)}>
                    delete
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}

function AccountPage({
  user,
  bagCount,
  onLogout,
  onUserUpdated,
}: {
  user: User;
  bagCount: number;
  onLogout: () => void;
  onUserUpdated: (user: User) => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setPhone(user.phone ?? "");
  }, [user.firstName, user.lastName, user.phone]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiRequest<{ user: User }>("/api/users/me/profile", {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      onUserUpdated(data.user);
      setSuccess("Профиль обновлен");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить профиль");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordError("");
    setPasswordSuccess("");
    try {
      await apiRequest<{ success: boolean }>("/api/users/me/password", {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Пароль изменен");
    } catch (requestError) {
      setPasswordError(requestError instanceof Error ? requestError.message : "Не удалось изменить пароль");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <main className="account-page">
      <section className="account-shell">
        <TopNav accountHref="/account" bagCount={bagCount} isAdmin={user.role === "ADMIN"} />
        <h1>Account</h1>
        <p className="account-subtitle">Управление личными данными и доступом</p>

        {error ? <p className="admin-error">{error}</p> : null}
        {success ? <p className="admin-success">{success}</p> : null}

        <form className="account-form" onSubmit={saveProfile}>
          <label>Email</label>
          <input value={user.email} disabled />

          <label>First name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Имя" />

          <label>Last name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Фамилия" />

          <label>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+79990000000" />

          <div className="account-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </button>
            <button type="button" className="secondary" onClick={() => window.location.assign("/orders")}>
              Orders
            </button>
            <button type="button" className="secondary" onClick={onLogout}>
              Logout
            </button>
          </div>
        </form>

        <section className="account-password">
          <h2>Change password</h2>
          {passwordError ? <p className="admin-error">{passwordError}</p> : null}
          {passwordSuccess ? <p className="admin-success">{passwordSuccess}</p> : null}
          <form className="account-form" onSubmit={changePassword}>
            <label>Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />

            <label>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />

            <label>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <div className="account-actions">
              <button type="submit" disabled={passwordSaving}>
                {passwordSaving ? "Saving..." : "Update password"}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}

function OrdersPage({ user, bagCount }: { user: User | null; bagCount: number }) {
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
        <TopNav accountHref={accountHref} bagCount={bagCount} isAdmin={user?.role === "ADMIN"} />
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
                <p className="order-total">Total: {formatPrice(order.totalRub)} RUB</p>
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

function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  async function loadPublicProducts() {
    setProductsLoading(true);
    try {
      const data = await apiRequest<{ products: Product[] }>("/api/products");
      setProducts(data.products);
    } finally {
      setProductsLoading(false);
    }
  }

  useEffect(() => {
    void loadPublicProducts();
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCart(readCart(GUEST_CART_KEY));
      setBootstrapping(false);
      return;
    }

    apiRequest<{ user: User }>("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((data) => {
        setUser(data.user);
        const userCart = readCart(getUserCartKey(data.user.id));
        const guestCart = readCart(GUEST_CART_KEY);
        const merged = mergeCarts(userCart, guestCart);
        setCart(merged);
        writeCart(getUserCartKey(data.user.id), merged);
        localStorage.removeItem(GUEST_CART_KEY);
      })
      .catch(() => {
        clearToken();
        setCart(readCart(GUEST_CART_KEY));
      })
      .finally(() => setBootstrapping(false));
  }, []);

  function handleAuth(token: string, currentUser: User) {
    setToken(token);
    setUser(currentUser);
    const userCart = readCart(getUserCartKey(currentUser.id));
    const guestCart = readCart(GUEST_CART_KEY);
    const merged = mergeCarts(userCart, guestCart);
    setCart(merged);
    writeCart(getUserCartKey(currentUser.id), merged);
    localStorage.removeItem(GUEST_CART_KEY);
  }

  function handleLogout() {
    clearToken();
    setUser(null);
    setCart(readCart(GUEST_CART_KEY));
  }

  function handleUserUpdated(nextUser: User) {
    setUser(nextUser);
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

  async function handleCheckout() {
    if (!user) return null;
    if (cart.length === 0) throw new Error("Корзина пустая");

    const orderData = await apiRequest<{ order: Order }>("/api/orders", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ items: cart }),
    });

    const payData = await apiRequest<{ confirmationUrl: string | null }>(`/api/orders/${orderData.order.id}/pay`, {
      method: "POST",
      headers: getAuthHeaders(),
    });

    setCart([]);
    return payData.confirmationUrl;
  }

  useEffect(() => {
    if (bootstrapping) return;
    if (user) writeCart(getUserCartKey(user.id), cart);
    else writeCart(GUEST_CART_KEY, cart);
  }, [bootstrapping, cart, user]);

  const bagCount = cart.reduce((acc, item) => acc + item.qty, 0);

  if (bootstrapping) return <main className="loading">Проверяем сессию...</main>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onAuth={handleAuth} />} />
      <Route path="/" element={<CatalogPage user={user} bagCount={bagCount} products={products} loading={productsLoading} />} />
      <Route
        path="/bag"
        element={
          <BagPage
            user={user}
            products={products}
            cart={cart}
            onIncreaseQty={handleAddToBag}
            onDecreaseQty={handleDecreaseCartQty}
            onCheckout={handleCheckout}
          />
        }
      />
      <Route
        path="/product/:id"
        element={<ProductPage user={user} products={products} onAddToBag={handleAddToBag} bagCount={bagCount} />}
      />
      <Route
        path="/account"
        element={
          user ? (
            <AccountPage user={user} bagCount={bagCount} onLogout={handleLogout} onUserUpdated={handleUserUpdated} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/orders" element={<OrdersPage user={user} bagCount={bagCount} />} />
      <Route
        path="/admin/products"
        element={
          user && user.role === "ADMIN" ? (
            <AdminProductsPage bagCount={bagCount} onProductsChanged={loadPublicProducts} />
          ) : (
            <Navigate to={user ? "/" : "/login"} replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

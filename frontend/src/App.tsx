import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
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

type ProductsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type ProductsListResponse = {
  products: Product[];
  pagination: ProductsPagination;
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
  deliveryLabel: string | null;
  deliveryCountry: string;
  deliveryCity: string;
  deliveryStreet: string;
  deliveryHouse: string;
  deliveryApartment: string | null;
  deliveryPostalCode: string | null;
  deliveryComment: string | null;
  createdAt: string;
  items: OrderItem[];
};

type AdminOrder = Order & {
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
};

type WishlistApiItem = {
  productId: string;
};

type Address = {
  id: string;
  userId: string;
  label: string | null;
  country: string;
  city: string;
  street: string;
  house: string;
  apartment: string | null;
  postalCode: string | null;
  comment: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
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

type AddressFormState = {
  label: string;
  country: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
  comment: string;
  isDefault: boolean;
};

const TOKEN_KEY = "mfm_token";
const GUEST_CART_KEY = "mfm_cart_guest";
const GUEST_WISHLIST_KEY = "mfm_wishlist_guest";

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

function getSelectedAddressStorageKey(userId: string) {
  return `mfm_selected_address_${userId}`;
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

function readWishlist(key: string): string[] {
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

function writeWishlist(key: string, productIds: string[]) {
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(productIds))));
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
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(hasBody && !isFormDataBody ? { "Content-Type": "application/json" } : {}),
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
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function TopNav({
  accountHref,
  bagCount,
  wishlistCount = 0,
  isAdmin,
}: {
  accountHref: string;
  bagCount: number;
  wishlistCount?: number;
  isAdmin?: boolean;
}) {
  return (
    <header className="app-top-nav">
      <nav className="catalog-nav">
        [<NavLink to={accountHref}>account</NavLink> / <NavLink to="/bag">bag ({bagCount})</NavLink> /{" "}
        <NavLink to="/wishlist">wishlist ({wishlistCount})</NavLink> / <NavLink to="/" end>search</NavLink>
        {isAdmin ? <> / <NavLink to="/admin">admin</NavLink></> : null}]
      </nav>
    </header>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isTerminalOrderStatus(status: OrderStatus) {
  return status === "COMPLETED" || status === "CANCELLED";
}

function AdminSectionNav({ current }: { current: "products" | "orders" }) {
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
  wishlistCount,
  products,
  onProductsCached,
}: {
  user: User | null;
  bagCount: number;
  wishlistCount: number;
  products: Product[];
  onProductsCached: (items: Product[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"ALL" | Category>("ALL");
  const [minPriceFilter, setMinPriceFilter] = useState(0);
  const [maxPriceFilter, setMaxPriceFilter] = useState(0);
  const [brandQuery, setBrandQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagesMap, setPagesMap] = useState<Record<number, Product[]>>({});
  const [pagination, setPagination] = useState<ProductsPagination>({
    page: 1,
    limit: 30,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const accountHref = user ? "/account" : "/login";

  const catalogMinPrice = useMemo(() => {
    if (products.length === 0) return 0;
    return products.reduce((min, item) => Math.min(min, item.priceRub), Number.POSITIVE_INFINITY);
  }, [products]);

  const catalogMaxPrice = useMemo(() => {
    if (products.length === 0) return 0;
    return products.reduce((max, item) => Math.max(max, item.priceRub), 0);
  }, [products]);

  const availableBrands = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((item) => item.brand.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) =>
      a.localeCompare(b, "ru-RU"),
    );
  }, [products]);

  const visibleBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return availableBrands;
    return availableBrands.filter((brand) => brand.toLowerCase().includes(q));
  }, [availableBrands, brandQuery]);

  const selectedBrandsParam = useMemo(() => selectedBrands.slice().sort().join(","), [selectedBrands]);
  const filterKey = `${query.trim().toLowerCase()}|${category}|${minPriceFilter}|${maxPriceFilter}|${selectedBrandsParam}`;

  useEffect(() => {
    setCurrentPage(1);
    setPagesMap({});
    setPagination((prev) => ({ ...prev, page: 1, total: 0, totalPages: 1, hasNext: false, hasPrev: false }));
  }, [filterKey]);

  useEffect(() => {
    if (products.length === 0) {
      setMinPriceFilter(0);
      setMaxPriceFilter(0);
      return;
    }

    if (maxPriceFilter === 0 && minPriceFilter === 0) {
      setMinPriceFilter(catalogMinPrice);
      setMaxPriceFilter(catalogMaxPrice);
      return;
    }

    setMinPriceFilter((prev) => Math.max(catalogMinPrice, Math.min(prev, catalogMaxPrice)));
    setMaxPriceFilter((prev) => Math.max(catalogMinPrice, Math.min(prev, catalogMaxPrice)));
  }, [products.length, catalogMinPrice, catalogMaxPrice]);

  function updateMinPrice(value: string) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    const clamped = Math.max(catalogMinPrice, Math.min(next, maxPriceFilter));
    setMinPriceFilter(clamped);
  }

  function updateMaxPrice(value: string) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    const clamped = Math.min(catalogMaxPrice, Math.max(next, minPriceFilter));
    setMaxPriceFilter(clamped);
  }

  useEffect(() => {
    setSelectedBrands((prev) => prev.filter((brand) => availableBrands.includes(brand)));
  }, [availableBrands]);

  function toggleBrand(brand: string) {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((value) => value !== brand) : [...prev, brand],
    );
  }

  function resetCatalogFilters() {
    setCategory("ALL");
    setQuery("");
    setBrandQuery("");
    setSelectedBrands([]);
    setMinPriceFilter(catalogMinPrice);
    setMaxPriceFilter(catalogMaxPrice);
  }

  const items = useMemo(() => {
    return pagesMap[currentPage] ?? [];
  }, [pagesMap, currentPage]);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      if (pagesMap[currentPage]) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", "30");
        if (query.trim()) params.set("q", query.trim());
        if (category !== "ALL") params.set("category", category);
        if (minPriceFilter > 0) params.set("priceFrom", String(minPriceFilter));
        if (maxPriceFilter > 0) params.set("priceTo", String(maxPriceFilter));
        if (selectedBrandsParam) params.set("brands", selectedBrandsParam);

        const data = await apiRequest<ProductsListResponse>(`/api/products?${params.toString()}`);
        if (cancelled) return;

        setPagesMap((prev) => ({ ...prev, [currentPage]: data.products }));
        setPagination(data.pagination);
        onProductsCached(data.products);

        const prefetchUntil = Math.min(5, data.pagination.totalPages);
        for (let page = 1; page <= prefetchUntil; page += 1) {
          if (page === currentPage || pagesMap[page]) continue;
          const prefetchParams = new URLSearchParams(params);
          prefetchParams.set("page", String(page));
          void apiRequest<ProductsListResponse>(`/api/products?${prefetchParams.toString()}`)
            .then((prefetchData) => {
              if (cancelled) return;
              setPagesMap((prev) => (prev[page] ? prev : { ...prev, [page]: prefetchData.products }));
              onProductsCached(prefetchData.products);
            })
            .catch(() => undefined);
        }
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить каталог");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [currentPage, query, category, minPriceFilter, maxPriceFilter, selectedBrandsParam, onProductsCached]);

  return (
    <main className="catalog-page">
      <section className="catalog-shell">
        <TopNav
          accountHref={accountHref}
          bagCount={bagCount}
          wishlistCount={wishlistCount}
          isAdmin={user?.role === "ADMIN"}
        />
        <header className="catalog-topbar">
          <label className="catalog-search">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="typing..." aria-label="Поиск" />
          </label>
        </header>

        <section className="catalog-content">
          <aside className="catalog-filters">
            <strong>FILTERS:</strong>
            <div className="filter-group">
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
            </div>

            <div className="filter-group">
              <strong>PRICE:</strong>
              <div className="price-manual">
                <label>
                  от
                  <input
                    type="number"
                    min={catalogMinPrice}
                    max={catalogMaxPrice || 0}
                    step={500}
                    value={minPriceFilter}
                    onChange={(e) => updateMinPrice(e.target.value)}
                  />
                </label>
                <label>
                  до
                  <input
                    type="number"
                    min={catalogMinPrice}
                    max={catalogMaxPrice || 0}
                    step={500}
                    value={maxPriceFilter}
                    onChange={(e) => updateMaxPrice(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="filter-group brand-filter-group">
              <strong>BRANDS:</strong>
              <input
                type="text"
                value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)}
                placeholder="find brand..."
                aria-label="Поиск бренда"
              />
              <div className="brand-list">
                {visibleBrands.map((brand) => (
                  <label key={brand}>
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(brand)}
                      onChange={() => toggleBrand(brand)}
                    />
                    <span className="brand-option-text" title={brand}>
                      {brand}
                    </span>
                  </label>
                ))}
                {visibleBrands.length === 0 ? <p>Ничего не найдено</p> : null}
              </div>
            </div>

            <button type="button" className="filters-reset" onClick={resetCatalogFilters}>
              reset filters
            </button>
          </aside>

          <div className="catalog-grid-wrap">
            {error ? <p className="admin-error">{error}</p> : null}
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
                      <p className={`source-inline ${item.sourceType === "INTERNAL" ? "internal" : "external"}`}>
                        {item.sourceType === "INTERNAL"
                          ? `Источник: ${item.sourceName}`
                          : `Источник: ${item.sourceName}`}
                      </p>
                      <p className="price">{formatPrice(item.priceRub)}</p>
                    </article>
                  </Link>
                ))}
              </div>
            )}
            {pagination.totalPages > 1 ? (
              <div className="catalog-pagination">
                <button type="button" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={!pagination.hasPrev}>
                  prev
                </button>
                <span>
                  page {currentPage} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  disabled={!pagination.hasNext}
                >
                  next
                </button>
              </div>
            ) : null}
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
  onQuickBuy,
  bagCount,
  wishlistCount,
  onAddToWishlist,
}: {
  user: User | null;
  products: Product[];
  onAddToBag: (productId: string, size: string) => void;
  onQuickBuy: (productId: string, size: string) => Promise<string | null>;
  bagCount: number;
  wishlistCount: number;
  onAddToWishlist: (productId: string) => Promise<void>;
}) {
  const { id } = useParams();
  const item = products.find((product) => product.id === id);
  const [size, setSize] = useState(item?.sizes?.[0] ?? "ONE SIZE");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistMessage, setWishlistMessage] = useState("");
  const [quickBuyLoading, setQuickBuyLoading] = useState(false);
  const [quickBuyMessage, setQuickBuyMessage] = useState("");
  const accountHref = user ? "/account" : "/login";
  const navigate = useNavigate();

  useEffect(() => {
    if (item?.sizes?.length) setSize(item.sizes[0]);
  }, [item?.id]);

  useEffect(() => {
    setPhotoIndex(0);
  }, [item?.id]);

  if (!item) return <Navigate to="/" replace />;
  const galleryImages = item.images.length > 0 ? item.images : [""];
  const currentImage = galleryImages[photoIndex] ?? galleryImages[0];

  function showPrevImage() {
    setPhotoIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  }

  function showNextImage() {
    setPhotoIndex((prev) => (prev + 1) % galleryImages.length);
  }

  async function addToWishlist() {
    setWishlistMessage("");
    if (!item) return;

    setWishlistLoading(true);
    try {
      await onAddToWishlist(item.id);
      setWishlistMessage("Добавлено в wishlist");
    } catch (requestError) {
      setWishlistMessage(requestError instanceof Error ? requestError.message : "Не удалось добавить в wishlist");
    } finally {
      setWishlistLoading(false);
    }
  }

  async function handleQuickBuyClick() {
    setQuickBuyMessage("");
    if (!user) {
      navigate("/login");
      return;
    }
    if (!item) return;

    setQuickBuyLoading(true);
    try {
      const confirmationUrl = await onQuickBuy(item.id, size);
      if (confirmationUrl) {
        window.location.assign(confirmationUrl);
      } else {
        window.location.assign("/orders");
      }
    } catch (requestError) {
      setQuickBuyMessage(requestError instanceof Error ? requestError.message : "Не удалось создать оплату");
    } finally {
      setQuickBuyLoading(false);
    }
  }

  return (
    <main className="product-page">
      <section className="product-shell">
        <TopNav
          accountHref={accountHref}
          bagCount={bagCount}
          wishlistCount={wishlistCount}
          isAdmin={user?.role === "ADMIN"}
        />

        <section className="product-main">
          <div className="product-visual-wrap">
            <div className="product-gallery-frame">
              <div
                className={`product-image product-detail-image ${categoryClass(item.category)}`}
                style={visualStyle(currentImage)}
              ></div>
              <button
                type="button"
                className="gallery-arrow left"
                onClick={showPrevImage}
                aria-label="Предыдущее фото"
                disabled={galleryImages.length <= 1}
              >
                {"‹"}
              </button>
              <button
                type="button"
                className="gallery-arrow right"
                onClick={showNextImage}
                aria-label="Следующее фото"
                disabled={galleryImages.length <= 1}
              >
                {"›"}
              </button>
            </div>
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

            <p className="total-price">Total price: {formatPrice(item.priceRub)}</p>

            <div className="product-actions">
              <button type="button" className="primary" onClick={() => onAddToBag(item.id, size)}>
                ADD TO BAG
              </button>
              <button type="button" className="secondary" onClick={handleQuickBuyClick} disabled={quickBuyLoading}>
                {quickBuyLoading ? "PREPARING..." : "QUICK BUY"}
              </button>
              <button type="button" className="wishlist" onClick={addToWishlist} disabled={wishlistLoading}>
                {wishlistLoading ? "ADDING..." : "ADD TO WISHLIST"}
              </button>
              {quickBuyMessage ? <p className="account-subtitle">{quickBuyMessage}</p> : null}
              {wishlistMessage ? <p className="account-subtitle">{wishlistMessage}</p> : null}
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
  wishlistCount,
}: {
  user: User | null;
  products: Product[];
  cart: CartItem[];
  onIncreaseQty: (productId: string, size: string) => void;
  onDecreaseQty: (productId: string, size: string) => void;
  onCheckout: (addressId: string) => Promise<string | null>;
  wishlistCount: number;
}) {
  const navigate = useNavigate();
  const accountHref = user ? "/account" : "/login";
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [bagAddressForm, setBagAddressForm] = useState<AddressFormState>({
    ...EMPTY_ADDRESS_FORM,
    isDefault: true,
  });
  const lines = cart
    .map((row) => {
      const item = products.find((x) => x.id === row.productId);
      if (!item) return null;
      return { row, item, total: row.qty * item.priceRub };
    })
    .filter((x): x is { row: CartItem; item: Product; total: number } => Boolean(x));

  const totalQty = lines.reduce((acc, line) => acc + line.row.qty, 0);
  const subtotal = lines.reduce((acc, line) => acc + line.total, 0);
  const totalPrice = subtotal;

  async function loadAddresses() {
    if (!user) {
      setAddresses([]);
      setSelectedAddressId("");
      return;
    }
    setAddressesLoading(true);
    try {
      const data = await apiRequest<{ addresses: Address[] }>("/api/users/me/addresses", {
        headers: getAuthHeaders(),
      });
      setAddresses(data.addresses);
      const storageKey = getSelectedAddressStorageKey(user.id);
      const stored = localStorage.getItem(storageKey);
      const nextSelected =
        (stored && data.addresses.some((item) => item.id === stored) && stored) ||
        data.addresses.find((item) => item.isDefault)?.id ||
        data.addresses[0]?.id ||
        "";
      setSelectedAddressId(nextSelected);
      if (nextSelected) localStorage.setItem(storageKey, nextSelected);
    } catch (requestError) {
      setCheckoutError(requestError instanceof Error ? requestError.message : "Не удалось загрузить адреса");
    } finally {
      setAddressesLoading(false);
    }
  }

  useEffect(() => {
    void loadAddresses();
  }, [user?.id]);

  useEffect(() => {
    if (!user || !selectedAddressId) return;
    localStorage.setItem(getSelectedAddressStorageKey(user.id), selectedAddressId);
  }, [selectedAddressId, user?.id]);

  async function createAddressFromBag(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }
    setAddressSaving(true);
    setCheckoutError("");
    try {
      const data = await apiRequest<{ address: Address }>("/api/users/me/addresses", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          label: bagAddressForm.label.trim() || undefined,
          country: bagAddressForm.country,
          city: bagAddressForm.city,
          street: bagAddressForm.street,
          house: bagAddressForm.house,
          apartment: bagAddressForm.apartment.trim() || undefined,
          postalCode: bagAddressForm.postalCode.trim() || undefined,
          comment: bagAddressForm.comment.trim() || undefined,
          isDefault: bagAddressForm.isDefault,
        }),
      });
      setShowAddressModal(false);
      setBagAddressForm({ ...EMPTY_ADDRESS_FORM, isDefault: true });
      await loadAddresses();
      setSelectedAddressId(data.address.id);
    } catch (requestError) {
      setCheckoutError(requestError instanceof Error ? requestError.message : "Не удалось сохранить адрес");
    } finally {
      setAddressSaving(false);
    }
  }

  async function handleCheckoutClick() {
    setCheckoutError("");
    if (!user) {
      navigate("/login");
      return;
    }
    if (!selectedAddressId) {
      setCheckoutError("Выберите адрес доставки перед оплатой");
      if (addresses.length === 0) setShowAddressModal(true);
      return;
    }

    setCheckoutLoading(true);
    try {
      const confirmationUrl = await onCheckout(selectedAddressId);
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
        <TopNav
          accountHref={accountHref}
          bagCount={totalQty}
          wishlistCount={wishlistCount}
          isAdmin={user?.role === "ADMIN"}
        />

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

              <div className="address-select-box">
                <label htmlFor="bag-address-select">Delivery address</label>
                {addressesLoading ? (
                  <p className="account-subtitle">Загружаем адреса...</p>
                ) : addresses.length > 0 ? (
                  <select
                    id="bag-address-select"
                    value={selectedAddressId}
                    onChange={(e) => setSelectedAddressId(e.target.value)}
                  >
                    <option value="">Выберите адрес</option>
                    {addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label || "Address"} — {address.city}, {address.street}, {address.house}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="address-empty">
                    <p>Нет сохраненных адресов доставки.</p>
                    <button type="button" onClick={() => setShowAddressModal(true)}>
                      Add address
                    </button>
                  </div>
                )}
              </div>

              <Link to="/" className="continue-link">
                Continue shopping
              </Link>

              <p className="total-final">
                <span>Total</span>
                <strong>{formatPrice(totalPrice)}</strong>
              </p>

              {checkoutError ? <p className="admin-error">{checkoutError}</p> : null}
              <button
                type="button"
                className="checkout-btn"
                onClick={handleCheckoutClick}
                disabled={checkoutLoading || (!!user && !selectedAddressId)}
              >
                {checkoutLoading ? "Подготовка платежа..." : "Proceed to Checkout"}
              </button>
            </aside>
          </section>
        )}

        {showAddressModal ? (
          <div className="address-modal-overlay" role="dialog" aria-modal="true">
            <div className="address-modal">
              <h2>Добавьте адрес доставки</h2>
              <form className="account-form" onSubmit={createAddressFromBag}>
                <label>Название адреса</label>
                <input
                  value={bagAddressForm.label}
                  onChange={(e) => setBagAddressForm((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="Дом / Офис"
                />
                <label>Страна</label>
                <input
                  value={bagAddressForm.country}
                  disabled
                />
                <label>Город</label>
                <input
                  value={bagAddressForm.city}
                  onChange={(e) => setBagAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                  required
                />
                <label>Улица</label>
                <input
                  value={bagAddressForm.street}
                  onChange={(e) => setBagAddressForm((prev) => ({ ...prev, street: e.target.value }))}
                  required
                />
                <label>Дом</label>
                <input
                  value={bagAddressForm.house}
                  onChange={(e) => setBagAddressForm((prev) => ({ ...prev, house: e.target.value }))}
                  required
                />
                <label>Квартира</label>
                <input
                  value={bagAddressForm.apartment}
                  onChange={(e) => setBagAddressForm((prev) => ({ ...prev, apartment: e.target.value }))}
                />
                <div className="account-actions">
                  <button type="submit" disabled={addressSaving}>
                    {addressSaving ? "Saving..." : "Save address"}
                  </button>
                  <button type="button" className="secondary" onClick={() => setShowAddressModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
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

const EMPTY_ADDRESS_FORM: AddressFormState = {
  label: "",
  country: "Россия",
  city: "",
  street: "",
  house: "",
  apartment: "",
  postalCode: "",
  comment: "",
  isDefault: false,
};

function normalizeList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function AdminProductsPage({
  bagCount,
  wishlistCount,
  onProductsChanged,
}: {
  bagCount: number;
  wishlistCount: number;
  onProductsChanged: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [draggingImageIndex, setDraggingImageIndex] = useState<number | null>(null);
  const [draggingPendingIndex, setDraggingPendingIndex] = useState<number | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
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

  function getFormImages() {
    return normalizeList(form.imagesText);
  }

  function setFormImages(images: string[]) {
    setField("imagesText", images.join("\n"));
  }

  function withPreviewNonce(url: string) {
    const divider = url.includes("?") ? "&" : "?";
    return `${url}${divider}v=${previewNonce}`;
  }

  const pendingPreviewUrls = useMemo(
    () => pendingUploadFiles.map((file) => URL.createObjectURL(file)),
    [pendingUploadFiles],
  );

  useEffect(() => {
    return () => {
      for (const url of pendingPreviewUrls) URL.revokeObjectURL(url);
    };
  }, [pendingPreviewUrls]);

  function startEdit(product: Product) {
    setEditingId(product.id);
    setPendingUploadFiles([]);
    setDraggingPendingIndex(null);
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
    setPendingUploadFiles([]);
    setDraggingImageIndex(null);
    setDraggingPendingIndex(null);
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
      let targetProductId: string | null = editingId;
      const productName = form.name.trim();
      let successMessage = editingId ? "Товар обновлен" : "Товар добавлен";

      if (editingId) {
        await apiRequest<{ product: Product }>(`/api/admin/products/${editingId}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        const created = await apiRequest<{ product: Product }>("/api/admin/products", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        targetProductId = created.product.id;
      }

      if (pendingUploadFiles.length > 0 && targetProductId) {
        for (const file of pendingUploadFiles) {
          const uploaded = await uploadProductImageById(targetProductId, file, false);
          if (uploaded && editingId === targetProductId) {
            setFormImages(uploaded.images);
          }
        }
        successMessage = `${successMessage}, фото загружены`;
      }

      await loadAdminProducts();
      await onProductsChanged();
      setSuccess(`${successMessage}: ${productName}`);
      resetForm();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить товар");
    } finally {
      setUploadingProductId(null);
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

  async function uploadProductImageById(productId: string, file: File, refreshAfter = true) {
    setError("");
    if (refreshAfter) setSuccess("");
    setUploadingProductId(productId);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiRequest<{ product: Product }>(`/api/admin/products/${productId}/images`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (refreshAfter) {
        await loadAdminProducts();
        await onProductsChanged();
        setSuccess(`Фото добавлено`);
      }
      setPreviewNonce((prev) => prev + 1);
      return response.product;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить фото");
      return null;
    } finally {
      setUploadingProductId(null);
    }
  }

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <TopNav accountHref={accountHref} bagCount={bagCount} wishlistCount={wishlistCount} isAdmin />
        <AdminSectionNav current="products" />

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
            placeholder="Price (₽)"
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
          <div className="admin-upload-inline">
            <span className="admin-upload-hint">
              {editingId
                ? "Загрузка фото (сразу применяется):"
                : "Фото можно выбрать сразу — загрузится после Create product:"}
            </span>
            <label className="upload-image-button">
              {pendingUploadFiles.length > 0 ? "add more photos" : "select photos"}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={saving || uploadingProductId !== null}
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length === 0) {
                    e.currentTarget.value = "";
                    return;
                  }

                  if (editingId) {
                    for (const file of files) {
                      const uploaded = await uploadProductImageById(editingId, file, false);
                      if (uploaded) {
                        setFormImages(uploaded.images);
                      }
                    }
                    await loadAdminProducts();
                    await onProductsChanged();
                    setSuccess("Фото добавлены");
                  } else {
                    setPendingUploadFiles((prev) => [...prev, ...files]);
                  }
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <span className="admin-upload-hint">
              {pendingUploadFiles.length > 0 ? `выбрано: ${pendingUploadFiles.length}` : "файл не выбран"}
            </span>
          </div>
          {getFormImages().length > 0 ? (
            <div className="admin-images-grid">
              {getFormImages().map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="admin-image-card"
                  draggable
                  onDragStart={() => setDraggingImageIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggingImageIndex === null || draggingImageIndex === index) return;
                    const next = getFormImages();
                    const [moved] = next.splice(draggingImageIndex, 1);
                    if (!moved) return;
                    next.splice(index, 0, moved);
                    setFormImages(next);
                    setDraggingImageIndex(null);
                  }}
                  onDragEnd={() => setDraggingImageIndex(null)}
                >
                  <button
                    type="button"
                    className="admin-image-remove"
                    onClick={() => {
                      const next = getFormImages().filter((_, imageIdx) => imageIdx !== index);
                      setFormImages(next);
                    }}
                    aria-label="Удалить фото"
                  >
                    ×
                  </button>
                  <img className="admin-image-preview" src={withPreviewNonce(url)} alt={`Фото ${index + 1}`} />
                  <p className="admin-image-meta">{index + 1}</p>
                </div>
              ))}
            </div>
          ) : null}
          {!editingId && pendingUploadFiles.length > 0 ? (
            <div className="admin-images-grid">
              {pendingUploadFiles.map((file, index) => (
                <div
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className="admin-image-card pending"
                  draggable
                  onDragStart={() => setDraggingPendingIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggingPendingIndex === null || draggingPendingIndex === index) return;
                    setPendingUploadFiles((prev) => {
                      const next = [...prev];
                      const [moved] = next.splice(draggingPendingIndex, 1);
                      if (!moved) return prev;
                      next.splice(index, 0, moved);
                      return next;
                    });
                    setDraggingPendingIndex(null);
                  }}
                  onDragEnd={() => setDraggingPendingIndex(null)}
                >
                  <button
                    type="button"
                    className="admin-image-remove"
                    onClick={() => {
                      setPendingUploadFiles((prev) => prev.filter((_, fileIdx) => fileIdx !== index));
                    }}
                    aria-label="Удалить фото"
                  >
                    ×
                  </button>
                  <img className="admin-image-preview" src={pendingPreviewUrls[index]} alt={`Новое фото ${index + 1}`} />
                  <p className="admin-image-meta">new {index + 1}</p>
                </div>
              ))}
            </div>
          ) : null}
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
                    {product.category} · {formatPrice(product.priceRub)} · {product.isActive ? "ACTIVE" : "INACTIVE"}
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
                  <label className="upload-image-button">
                    {uploadingProductId === product.id ? "uploading..." : "upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingProductId === product.id}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const uploaded = await uploadProductImageById(product.id, file);
                          if (uploaded && editingId === product.id) {
                            setFormImages(uploaded.images);
                          }
                        }
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}

function AdminOrdersPage({ bagCount, wishlistCount }: { bagCount: number; wishlistCount: number }) {
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

function AccountPage({
  user,
  bagCount,
  wishlistCount,
  onLogout,
  onUserUpdated,
}: {
  user: User;
  bagCount: number;
  wishlistCount: number;
  onLogout: () => void;
  onUserUpdated: (user: User) => void;
}) {
  const [section, setSection] = useState<"profile" | "addresses">("profile");
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressFormState>(EMPTY_ADDRESS_FORM);
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

  async function loadAddresses() {
    setAddressesLoading(true);
    try {
      const data = await apiRequest<{ addresses: Address[] }>("/api/users/me/addresses", {
        headers: getAuthHeaders(),
      });
      setAddresses(data.addresses);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить адреса");
    } finally {
      setAddressesLoading(false);
    }
  }

  useEffect(() => {
    if (section !== "addresses") return;
    void loadAddresses();
  }, [section]);

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

  async function createAddress(e: FormEvent) {
    e.preventDefault();
    setAddressSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiRequest<{ address: Address }>("/api/users/me/addresses", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          label: addressForm.label.trim() || undefined,
          country: addressForm.country,
          city: addressForm.city,
          street: addressForm.street,
          house: addressForm.house,
          apartment: addressForm.apartment.trim() || undefined,
          postalCode: addressForm.postalCode.trim() || undefined,
          comment: addressForm.comment.trim() || undefined,
          isDefault: addressForm.isDefault,
        }),
      });
      setAddressForm(EMPTY_ADDRESS_FORM);
      await loadAddresses();
      setSuccess("Адрес добавлен");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить адрес");
    } finally {
      setAddressSaving(false);
    }
  }

  async function removeAddress(addressId: string) {
    try {
      await apiRequest(`/api/users/me/addresses/${addressId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      await loadAddresses();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось удалить адрес");
    }
  }

  async function makeDefault(addressId: string) {
    try {
      await apiRequest<{ address: Address }>(`/api/users/me/addresses/${addressId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isDefault: true }),
      });
      await loadAddresses();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось обновить адрес");
    }
  }

  return (
    <main className="account-page">
      <section className="account-shell">
        <TopNav
          accountHref="/account"
          bagCount={bagCount}
          wishlistCount={wishlistCount}
          isAdmin={user.role === "ADMIN"}
        />

        {error ? <p className="admin-error">{error}</p> : null}
        {success ? <p className="admin-success">{success}</p> : null}

        <div className="account-actions">
          <button type="button" className={section === "profile" ? "" : "secondary"} onClick={() => setSection("profile")}>
            Profile
          </button>
          <button
            type="button"
            className={section === "addresses" ? "" : "secondary"}
            onClick={() => setSection("addresses")}
          >
            Addresses
          </button>
          <button type="button" className="secondary" onClick={() => window.location.assign("/orders")}>
            Orders
          </button>
          <button type="button" className="secondary" onClick={onLogout}>
            Logout
          </button>
        </div>

        {section === "profile" ? (
          <>
            <form className="account-form account-profile-form" onSubmit={saveProfile}>
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
          </>
        ) : (
          <section className="account-addresses">
            <h2>Addresses</h2>
            {addressesLoading ? <p className="account-subtitle">Загрузка адресов...</p> : null}
            {!addressesLoading && addresses.length === 0 ? (
              <p className="account-subtitle">Пока нет сохраненных адресов.</p>
            ) : null}
            {addresses.map((address) => (
              <article key={address.id} className="address-card">
                <p className="title">
                  {address.label || "Address"} {address.isDefault ? "· default" : ""}
                </p>
                <p className="meta">
                  {address.country}, {address.city}, {address.street}, {address.house}
                  {address.apartment ? `, кв. ${address.apartment}` : ""}
                </p>
                {address.postalCode ? <p className="meta">Индекс: {address.postalCode}</p> : null}
                {address.comment ? <p className="meta">{address.comment}</p> : null}
                <div className="item-actions">
                  {!address.isDefault ? (
                    <button type="button" onClick={() => void makeDefault(address.id)}>
                      make default
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void removeAddress(address.id)}>
                    delete
                  </button>
                </div>
              </article>
            ))}

            <form className="account-form" onSubmit={createAddress}>
              <label>Название адреса</label>
              <input
                value={addressForm.label}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Дом / Офис"
              />
              <label>Страна</label>
              <input
                value={addressForm.country}
                disabled
              />
              <label>Город</label>
              <input
                value={addressForm.city}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                required
              />
              <label>Улица</label>
              <input
                value={addressForm.street}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, street: e.target.value }))}
                required
              />
              <label>Дом</label>
              <input
                value={addressForm.house}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, house: e.target.value }))}
                required
              />
              <label>Квартира (опционально)</label>
              <input
                value={addressForm.apartment}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, apartment: e.target.value }))}
              />
              <label>Почтовый индекс</label>
              <input
                value={addressForm.postalCode}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, postalCode: e.target.value }))}
              />
              <label>Комментарий</label>
              <input
                value={addressForm.comment}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, comment: e.target.value }))}
              />
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                />
                Сделать адресом по умолчанию
              </label>
              <div className="account-actions">
                <button type="submit" disabled={addressSaving}>
                  {addressSaving ? "Saving..." : "Save address"}
                </button>
              </div>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}

function OrdersPage({ user, bagCount, wishlistCount }: { user: User | null; bagCount: number; wishlistCount: number }) {
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
        <TopNav
          accountHref={accountHref}
          bagCount={bagCount}
          wishlistCount={wishlistCount}
          isAdmin={user?.role === "ADMIN"}
        />
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

function WishlistPage({
  user,
  products,
  bagCount,
  wishlistCount,
  wishlistProductIds,
  onRemoveFromWishlist,
}: {
  user: User | null;
  products: Product[];
  bagCount: number;
  wishlistCount: number;
  wishlistProductIds: string[];
  onRemoveFromWishlist: (productId: string) => Promise<void>;
}) {
  const accountHref = user ? "/account" : "/login";
  const [removingProductId, setRemovingProductId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const wishlistLines = useMemo(() => {
    return wishlistProductIds
      .map((productId) => products.find((product) => product.id === productId))
      .filter((item): item is Product => Boolean(item))
      .map((item) => ({
        product: item,
        productId: item.id,
      }));
  }, [products, wishlistProductIds]);

  async function handleRemove(productId: string) {
    setError("");
    setRemovingProductId(productId);
    try {
      await onRemoveFromWishlist(productId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось удалить товар из wishlist");
    } finally {
      setRemovingProductId(null);
    }
  }

  return (
    <main className="account-page">
      <section className="account-shell">
        <TopNav
          accountHref={accountHref}
          bagCount={bagCount}
          wishlistCount={wishlistCount}
          isAdmin={user?.role === "ADMIN"}
        />
        {!user ? <p className="account-subtitle">Гостевой wishlist сохранится и перенесется после входа.</p> : null}
        {error ? <p className="admin-error">{error}</p> : null}
        {wishlistLines.length === 0 ? <p className="account-subtitle">В wishlist пока пусто.</p> : null}
        {wishlistLines.length > 0 ? (
          <section className="bag-layout wishlist-layout">
            <div className="bag-left">
              <div className="bag-header">
                <span>Product</span>
                <span>Price</span>
                <span>Actions</span>
              </div>
              {wishlistLines.map((line) => (
                <div className="bag-row wishlist-row" key={line.productId}>
                  <div className="bag-product">
                    <div
                      className={`bag-thumb ${categoryClass(line.product.category)}`}
                      style={visualStyle(line.product.images[0])}
                    ></div>
                    <div>
                      <p className="brand">{line.product.brand}</p>
                      <p className="name">{line.product.name}</p>
                      <p className="size">size {line.product.sizes[0] ?? "ONE SIZE"}</p>
                    </div>
                  </div>
                  <p className="bag-line-total">{formatPrice(line.product.priceRub)}</p>
                  <div className="item-actions wishlist-actions">
                    <Link to={`/product/${line.productId}`} className="wishlist-open-link">
                      Открыть
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRemove(line.productId)}
                      disabled={removingProductId === line.productId}
                    >
                      {removingProductId === line.productId ? "Удаляем..." : "Удалить"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlistProductIds, setWishlistProductIds] = useState<string[]>([]);

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

  async function loadWishlist() {
    if (!getToken()) {
      setWishlistProductIds(readWishlist(GUEST_WISHLIST_KEY));
      return;
    }
    const data = await apiRequest<{ wishlist: WishlistApiItem[] }>("/api/wishlist", {
      headers: getAuthHeaders(),
    });
    setWishlistProductIds(Array.from(new Set(data.wishlist.map((item) => item.productId))));
  }

  async function mergeGuestWishlistToUser(token: string, productIds: string[]) {
    if (productIds.length === 0) return;
    await Promise.all(
      productIds.map((productId) =>
        apiRequest<{ success: boolean }>("/api/wishlist", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ productId }),
        }).catch(() => null),
      ),
    );
  }

  useEffect(() => {
    void loadInitialProductsCache();
  }, [loadInitialProductsCache]);
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
  }, [cart, wishlistProductIds, products]);


  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCart(readCart(GUEST_CART_KEY));
      setWishlistProductIds(readWishlist(GUEST_WISHLIST_KEY));
      setBootstrapping(false);
      return;
    }

    apiRequest<{ user: User }>("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((data) => {
        setUser(data.user);
        const userCart = readCart(getUserCartKey(data.user.id));
        const guestCart = readCart(GUEST_CART_KEY);
        const merged = mergeCarts(userCart, guestCart);
        const guestWishlist = readWishlist(GUEST_WISHLIST_KEY);
        setCart(merged);
        writeCart(getUserCartKey(data.user.id), merged);
        localStorage.removeItem(GUEST_CART_KEY);
        return mergeGuestWishlistToUser(token, guestWishlist).then(() => {
          localStorage.removeItem(GUEST_WISHLIST_KEY);
          return loadWishlist();
        });
      })
      .catch(() => {
        clearToken();
        setCart(readCart(GUEST_CART_KEY));
        setWishlistProductIds(readWishlist(GUEST_WISHLIST_KEY));
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
    const guestWishlist = readWishlist(GUEST_WISHLIST_KEY);
    void mergeGuestWishlistToUser(token, guestWishlist).then(() => {
      localStorage.removeItem(GUEST_WISHLIST_KEY);
      return loadWishlist();
    });
  }

  function handleLogout() {
    clearToken();
    setUser(null);
    setCart(readCart(GUEST_CART_KEY));
    setWishlistProductIds(readWishlist(GUEST_WISHLIST_KEY));
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

  async function handleCheckout(addressId: string) {
    if (!user) return null;
    if (cart.length === 0) throw new Error("Корзина пустая");

    const orderData = await apiRequest<{ order: Order }>("/api/orders", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ items: cart, addressId }),
    });

    const payData = await apiRequest<{ confirmationUrl: string | null }>(`/api/orders/${orderData.order.id}/pay`, {
      method: "POST",
      headers: getAuthHeaders(),
    });

    setCart([]);
    return payData.confirmationUrl;
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
    await loadWishlist();
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
    await loadWishlist();
  }

  useEffect(() => {
    if (bootstrapping) return;
    if (user) writeCart(getUserCartKey(user.id), cart);
    else writeCart(GUEST_CART_KEY, cart);
  }, [bootstrapping, cart, user]);

  const bagCount = cart.reduce((acc, item) => acc + item.qty, 0);
  const wishlistCount = wishlistProductIds.length;

  if (bootstrapping) return <main className="loading">Проверяем сессию...</main>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onAuth={handleAuth} />} />
      <Route path="/admin" element={<Navigate to="/admin/products" replace />} />
      <Route
        path="/"
        element={
          <CatalogPage
            user={user}
            bagCount={bagCount}
            wishlistCount={wishlistCount}
            products={products}
            onProductsCached={cacheProducts}
          />
        }
      />
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
            wishlistCount={wishlistCount}
          />
        }
      />
      <Route
        path="/product/:id"
        element={
          <ProductPage
            user={user}
            products={products}
            onAddToBag={handleAddToBag}
            onQuickBuy={handleQuickBuy}
            bagCount={bagCount}
            wishlistCount={wishlistCount}
            onAddToWishlist={handleAddToWishlist}
          />
        }
      />
      <Route
        path="/account"
        element={
          user ? (
            <AccountPage
              user={user}
              bagCount={bagCount}
              wishlistCount={wishlistCount}
              onLogout={handleLogout}
              onUserUpdated={handleUserUpdated}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/orders" element={<OrdersPage user={user} bagCount={bagCount} wishlistCount={wishlistCount} />} />
      <Route
        path="/wishlist"
        element={
          <WishlistPage
            user={user}
            products={products}
            bagCount={bagCount}
            wishlistCount={wishlistCount}
            wishlistProductIds={wishlistProductIds}
            onRemoveFromWishlist={handleRemoveFromWishlist}
          />
        }
      />
      <Route
        path="/admin/products"
        element={
          user && user.role === "ADMIN" ? (
            <AdminProductsPage
              bagCount={bagCount}
              wishlistCount={wishlistCount}
              onProductsChanged={loadInitialProductsCache}
            />
          ) : (
            <Navigate to={user ? "/" : "/login"} replace />
          )
        }
      />
      <Route
        path="/admin/orders"
        element={
          user && user.role === "ADMIN" ? (
            <AdminOrdersPage bagCount={bagCount} wishlistCount={wishlistCount} />
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

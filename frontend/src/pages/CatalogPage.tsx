import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiRequest } from "../lib/http";
import { getProductHref } from "../lib/routes";
import { categoryClass, formatPrice, visualStyle } from "../lib/ui";
import { TopNav } from "../components/navigation/TopNav";
import type { Category, Product, ProductsListResponse, ProductsPagination, User } from "../types/domain";

const CATALOG_STATE_KEY = "mfm_catalog_state";

type PersistedCatalogState = {
  query: string;
  category: "ALL" | Category;
  minPriceFilter: number;
  maxPriceFilter: number;
  brandQuery: string;
  selectedBrands: string[];
};

function readPersistedCatalogState(): PersistedCatalogState | null {
  try {
    const raw = localStorage.getItem(CATALOG_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedCatalogState>;
    if (!parsed || typeof parsed !== "object") return null;

    const category = parsed.category;
    const validCategory =
      category === "ALL" || category === "TOPS" || category === "OUTER" || category === "BOTTOMS" || category === "OTHER"
        ? category
        : "ALL";

    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      category: validCategory,
      minPriceFilter: Number.isFinite(parsed.minPriceFilter) ? (parsed.minPriceFilter as number) : 0,
      maxPriceFilter: Number.isFinite(parsed.maxPriceFilter) ? (parsed.maxPriceFilter as number) : 0,
      brandQuery: typeof parsed.brandQuery === "string" ? parsed.brandQuery : "",
      selectedBrands: Array.isArray(parsed.selectedBrands)
        ? parsed.selectedBrands.filter((brand): brand is string => typeof brand === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function sanitizeBrand(value: string) {
  return value
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? " " : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

type CatalogPageProps = {
  user: User | null;
  bagCount: number;
  wishlistCount: number;
  products: Product[];
  onProductsCached: (items: Product[]) => void;
};

export function CatalogPage({ user, bagCount, wishlistCount, products, onProductsCached }: CatalogPageProps) {
  const [persistedState] = useState<PersistedCatalogState | null>(() => readPersistedCatalogState());
  const [query, setQuery] = useState(persistedState?.query ?? "");
  const [category, setCategory] = useState<"ALL" | Category>(persistedState?.category ?? "ALL");
  const [minPriceFilter, setMinPriceFilter] = useState(persistedState?.minPriceFilter ?? 0);
  const [maxPriceFilter, setMaxPriceFilter] = useState(persistedState?.maxPriceFilter ?? 0);
  const [brandQuery, setBrandQuery] = useState(persistedState?.brandQuery ?? "");
  const [selectedBrands, setSelectedBrands] = useState<string[]>(persistedState?.selectedBrands ?? []);
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
    const brandSourceItems = query.trim()
      ? products
      : products.filter((item) => item.sourceType === "INTERNAL");
    return Array.from(
      new Set(
        brandSourceItems
          .map((item) => sanitizeBrand(item.brand))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "ru-RU"));
  }, [products, query]);

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

  useEffect(() => {
    const stateToPersist: PersistedCatalogState = {
      query,
      category,
      minPriceFilter,
      maxPriceFilter,
      brandQuery,
      selectedBrands,
    };
    localStorage.setItem(CATALOG_STATE_KEY, JSON.stringify(stateToPersist));
  }, [query, category, minPriceFilter, maxPriceFilter, brandQuery, selectedBrands]);

  function toggleBrand(brand: string) {
    setSelectedBrands((prev) => (prev.includes(brand) ? prev.filter((value) => value !== brand) : [...prev, brand]));
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
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [currentPage]);

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
        <TopNav accountHref={accountHref} bagCount={bagCount} wishlistCount={wishlistCount} isAdmin={user?.role === "ADMIN"} />
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
                    <input type="checkbox" checked={selectedBrands.includes(brand)} onChange={() => toggleBrand(brand)} />
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
                  <Link key={item.id} to={getProductHref(item)} className="product-card-link">
                    <article className="product-card">
                      <div className={`product-image ${categoryClass(item.category)}`} style={visualStyle(item.images[0])}></div>
                      <p className="brand">{item.brand}</p>
                      <p className="name">{item.name}</p>
                      <p className={`source-inline ${item.sourceType === "INTERNAL" ? "internal" : "external"}`}>
                        {item.sourceType === "INTERNAL" ? `Источник: ${item.sourceName}` : `Источник: ${item.sourceName}`}
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

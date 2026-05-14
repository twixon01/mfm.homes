import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { TopNav } from "../components/navigation/TopNav";
import { apiRequest } from "../lib/http";
import { categoryClass, formatPrice, visualStyle } from "../lib/ui";
import type { Product, User } from "../types/domain";

type ProductPageProps = {
  user: User | null;
  products: Product[];
  onAddToBag: (productId: string, size: string) => void;
  onQuickBuy: (productId: string, size: string) => Promise<string | null>;
  bagCount: number;
  wishlistCount: number;
  onAddToWishlist: (productId: string) => Promise<void>;
};

export function ProductPage({
  user,
  products,
  onAddToBag,
  onQuickBuy,
  bagCount,
  wishlistCount,
  onAddToWishlist,
}: ProductPageProps) {
  const { id: routeParam } = useParams();
  const [searchParams] = useSearchParams();
  const requestedProductId = searchParams.get("id") ?? routeParam;
  const item = products.find((product) => product.id === requestedProductId);
  const [fetchedItem, setFetchedItem] = useState<Product | null>(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState("");
  const resolvedItem = item ?? fetchedItem;
  const [size, setSize] = useState(item?.sizes?.[0] ?? "ONE SIZE");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistMessage, setWishlistMessage] = useState("");
  const [quickBuyLoading, setQuickBuyLoading] = useState(false);
  const [quickBuyMessage, setQuickBuyMessage] = useState("");
  const accountHref = user ? "/account" : "/login";
  const navigate = useNavigate();

  useEffect(() => {
    if (!requestedProductId) return;
    if (item) {
      setFetchedItem(null);
      setItemError("");
      setItemLoading(false);
      return;
    }

    let cancelled = false;
    setItemLoading(true);
    setItemError("");

    void apiRequest<{ product: Product }>(`/api/products/${requestedProductId}`)
      .then((data) => {
        if (cancelled) return;
        setFetchedItem(data.product);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setItemError(requestError instanceof Error ? requestError.message : "Товар не найден");
        setFetchedItem(null);
      })
      .finally(() => {
        if (!cancelled) setItemLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedProductId, item]);

  useEffect(() => {
    if (resolvedItem?.sizes?.length) setSize(resolvedItem.sizes[0]);
  }, [resolvedItem]);

  useEffect(() => {
    setPhotoIndex(0);
  }, [resolvedItem?.id]);

  useEffect(() => {
    if (!resolvedItem) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [resolvedItem?.id]);

  if (!requestedProductId) return <Navigate to="/" replace />;
  if (itemLoading) {
    return (
      <main className="product-page">
        <section className="product-shell">
          <TopNav accountHref={accountHref} bagCount={bagCount} wishlistCount={wishlistCount} isAdmin={user?.role === "ADMIN"} />
          <p className="loading">Загружаем товар...</p>
        </section>
      </main>
    );
  }

  if (!resolvedItem) {
    return (
      <main className="product-page">
        <section className="product-shell">
          <TopNav accountHref={accountHref} bagCount={bagCount} wishlistCount={wishlistCount} isAdmin={user?.role === "ADMIN"} />
          <section className="bag-empty">
            <p>{itemError || "Товар не найден"}</p>
            <button type="button" className="secondary" onClick={() => navigate("/")}>
              Вернуться в каталог
            </button>
          </section>
        </section>
      </main>
    );
  }

  const galleryImages = resolvedItem.images.length > 0 ? resolvedItem.images : [""];
  const currentImage = galleryImages[photoIndex] ?? galleryImages[0];
  const hasDistinctBrand = resolvedItem.brand.trim().toLowerCase() !== resolvedItem.name.trim().toLowerCase();

  function showPrevImage() {
    setPhotoIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  }

  function showNextImage() {
    setPhotoIndex((prev) => (prev + 1) % galleryImages.length);
  }

  async function addToWishlist() {
    setWishlistMessage("");
    if (!resolvedItem) return;

    setWishlistLoading(true);
    try {
      await onAddToWishlist(resolvedItem.id);
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
    if (!resolvedItem) return;

    setQuickBuyLoading(true);
    try {
      const confirmationUrl = await onQuickBuy(resolvedItem.id, size);
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
        <TopNav accountHref={accountHref} bagCount={bagCount} wishlistCount={wishlistCount} isAdmin={user?.role === "ADMIN"} />

        <section className="product-main">
          <div className="product-visual-wrap">
            <div className="product-gallery-frame">
              <div
                className={`product-image product-detail-image ${categoryClass(resolvedItem.category)}`}
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
            <div className="product-heading">
              <h2 className="product-main-title" title={resolvedItem.name}>
                {resolvedItem.name}
              </h2>
              {hasDistinctBrand ? <p className="product-brand-subtitle">{resolvedItem.brand}</p> : null}
            </div>

            <div className="product-purchase">
              <p className={`source-badge ${resolvedItem.sourceType === "INTERNAL" ? "internal" : "external"}`}>
                {resolvedItem.sourceType === "INTERNAL"
                  ? `Источник: ${resolvedItem.sourceName}`
                  : `Источник: внешний (${resolvedItem.sourceName})`}
              </p>

              <label htmlFor="size-select">Size</label>
              <select id="size-select" value={size} onChange={(e) => setSize(e.target.value)}>
                {(resolvedItem.sizes.length ? resolvedItem.sizes : ["ONE SIZE"]).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <p className="total-price">Total price: {formatPrice(resolvedItem.priceRub)}</p>
            </div>

            <div className="product-actions">
              <button type="button" className="primary" onClick={() => onAddToBag(resolvedItem.id, size)}>
                ADD TO BAG
              </button>
              <button type="button" className="secondary" onClick={handleQuickBuyClick} disabled={quickBuyLoading}>
                {quickBuyLoading ? "PREPARING..." : "QUICK BUY"}
              </button>
              <button type="button" className="wishlist" onClick={addToWishlist} disabled={wishlistLoading}>
                {wishlistLoading ? "ADDING..." : "ADD TO WISHLIST"}
              </button>
              <div className="product-feedback" aria-live="polite">
                {quickBuyMessage ? <p className="account-subtitle">{quickBuyMessage}</p> : null}
                {wishlistMessage ? <p className="account-subtitle">{wishlistMessage}</p> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="product-description">
          <p className="product-full-title" title={resolvedItem.name}>
            {resolvedItem.name}
          </p>
          <h3>Description</h3>
          <p>{resolvedItem.description}</p>
        </section>
      </section>
    </main>
  );
}

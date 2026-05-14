import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { TopNav } from "../components/navigation/TopNav";
import { getProductHref } from "../lib/routes";
import { categoryClass, formatPrice, visualStyle } from "../lib/ui";
import type { Product, User } from "../types/domain";

type WishlistPageProps = {
  user: User | null;
  products: Product[];
  bagCount: number;
  wishlistCount: number;
  wishlistProductIds: string[];
  onRemoveFromWishlist: (productId: string) => Promise<void>;
};

export function WishlistPage({
  user,
  products,
  bagCount,
  wishlistCount,
  wishlistProductIds,
  onRemoveFromWishlist,
}: WishlistPageProps) {
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
        <TopNav accountHref={accountHref} bagCount={bagCount} wishlistCount={wishlistCount} isAdmin={user?.role === "ADMIN"} />
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
                    <div className={`bag-thumb ${categoryClass(line.product.category)}`} style={visualStyle(line.product.images[0])}></div>
                    <div>
                      <p className="brand">{line.product.brand}</p>
                      <p className="name">{line.product.name}</p>
                      <p className="size">size {line.product.sizes[0] ?? "ONE SIZE"}</p>
                    </div>
                  </div>
                  <p className="bag-line-total">{formatPrice(line.product.priceRub)}</p>
                  <div className="item-actions wishlist-actions">
                    <Link to={getProductHref(line.product)} className="wishlist-open-link">
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

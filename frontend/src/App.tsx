import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useCart } from "./hooks/useCart";
import { useProductsCache } from "./hooks/useProductsCache";
import { useSession } from "./hooks/useSession";
import { useWishlist } from "./hooks/useWishlist";
import { AdminOrdersPage } from "./pages/admin/AdminOrdersPage";
import { AdminProductsPage } from "./pages/admin/AdminProductsPage";
import { AccountPage } from "./pages/AccountPage";
import { BagPage } from "./pages/BagPage";
import { CatalogPage } from "./pages/CatalogPage";
import { LoginPage } from "./pages/LoginPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductPage } from "./pages/ProductPage";
import { WishlistPage } from "./pages/WishlistPage";
import type { User } from "./types/domain";

function App() {
  const location = useLocation();
  const { bootstrapping, user, handleAuth: setAuthenticatedUser, handleLogout: logoutSession, handleUserUpdated } = useSession();
  const {
  cart,
    applyGuestCart,
    applyAuthCart,
    handleAddToBag,
    handleDecreaseCartQty,
    handleCheckout,
    handleQuickBuy,
  } = useCart({ user, bootstrapping, pathname: location.pathname });
  const {
  wishlistProductIds,
    applyGuestWishlist,
    applyAuthWishlist,
    handleAddToWishlist,
    handleRemoveFromWishlist,
  } = useWishlist({ user });
  const { products, cacheProducts, loadInitialProductsCache } = useProductsCache({ cart, wishlistProductIds });
  const bootstrappedInitRef = useRef(false);

  useEffect(() => {
    void loadInitialProductsCache();
  }, [loadInitialProductsCache]);

  useEffect(() => {
    if (bootstrapping || bootstrappedInitRef.current) return;
    bootstrappedInitRef.current = true;
    if (user) {
      applyAuthCart(user.id);
      void applyAuthWishlist(user);
      return;
    }
    applyGuestCart();
    applyGuestWishlist();
  }, [bootstrapping, user, applyAuthCart, applyAuthWishlist, applyGuestCart, applyGuestWishlist]);

  function handleAuth(currentUser: User) {
    setAuthenticatedUser(currentUser);
    applyAuthCart(currentUser.id);
    void applyAuthWishlist(currentUser);
  }

  async function handleLogout() {
    await logoutSession();
    applyGuestCart();
    applyGuestWishlist();
  }

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
        path="/product/:slug"
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

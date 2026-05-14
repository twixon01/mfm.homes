import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { TopNav } from "../components/navigation/TopNav";
import { apiRequest, getAuthHeaders } from "../lib/http";
import { getSelectedAddressStorageKey } from "../lib/storage";
import { categoryClass, formatPrice, visualStyle } from "../lib/ui";
import type { Address, AddressFormState, CartItem, Product, User } from "../types/domain";

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

type BagPageProps = {
  user: User | null;
  products: Product[];
  cart: CartItem[];
  onIncreaseQty: (productId: string, size: string) => void;
  onDecreaseQty: (productId: string, size: string) => void;
  onCheckout: (addressId: string) => Promise<string | null>;
  wishlistCount: number;
};

export function BagPage({
  user,
  products,
  cart,
  onIncreaseQty,
  onDecreaseQty,
  onCheckout,
  wishlistCount,
}: BagPageProps) {
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
        <TopNav accountHref={accountHref} bagCount={totalQty} wishlistCount={wishlistCount} isAdmin={user?.role === "ADMIN"} />

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
                    <div className={`bag-thumb ${categoryClass(line.item.category)}`} style={visualStyle(line.item.images[0])}></div>
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
              <div className="address-select-box">
                <label htmlFor="bag-address-select">Delivery address</label>
                {addressesLoading ? (
                  <p className="account-subtitle">Загружаем адреса...</p>
                ) : addresses.length > 0 ? (
                  <select id="bag-address-select" value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)}>
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
                disabled={checkoutLoading}
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
                <input value={bagAddressForm.country} disabled />
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

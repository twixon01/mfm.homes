import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { TopNav } from "../components/navigation/TopNav";
import { apiRequest, getAuthHeaders } from "../lib/http";
import type { Address, AddressFormState, User } from "../types/domain";

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

type AccountPageProps = {
  user: User;
  bagCount: number;
  wishlistCount: number;
  onLogout: () => void | Promise<void>;
  onUserUpdated: (user: User) => void;
};

export function AccountPage({ user, bagCount, wishlistCount, onLogout, onUserUpdated }: AccountPageProps) {
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
        <TopNav accountHref="/account" bagCount={bagCount} wishlistCount={wishlistCount} isAdmin={user.role === "ADMIN"} />

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
            {!addressesLoading && addresses.length === 0 ? <p className="account-subtitle">Пока нет сохраненных адресов.</p> : null}
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
              <input value={addressForm.country} disabled />
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

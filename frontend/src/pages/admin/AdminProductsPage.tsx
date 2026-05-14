import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { AdminSectionNav } from "../../components/navigation/AdminSectionNav";
import { TopNav } from "../../components/navigation/TopNav";
import { apiRequest, getAuthHeaders } from "../../lib/http";
import { formatPrice } from "../../lib/ui";
import type { Category, Product, ProductFormState, SourceType } from "../../types/domain";

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

type AdminProductsPageProps = {
  bagCount: number;
  wishlistCount: number;
  onProductsChanged: () => Promise<void>;
};

export function AdminProductsPage({ bagCount, wishlistCount, onProductsChanged }: AdminProductsPageProps) {
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

import { expect, test, type Page, type Route } from "@playwright/test";

const smokeProduct = {
  id: "p-smoke-1",
  name: "Smoke Hoodie",
  brand: "SmokeBrand",
  description: "Smoke test product",
  priceRub: 12990,
  category: "TOPS",
  sizes: ["M", "L"],
  images: [""],
  condition: "NEW",
  sourceType: "INTERNAL",
  sourceName: "MFM",
  sourceUrl: null,
  isActive: true,
};

const smokeUser = {
  id: "user-smoke-1",
  email: "smoke-user@example.com",
  role: "USER",
  firstName: "Smoke",
  lastName: "User",
  phone: null,
};

const smokeAdmin = {
  id: "admin-smoke-1",
  email: "smoke-admin@example.com",
  role: "ADMIN",
  firstName: "Admin",
  lastName: "Smoke",
  phone: null,
};

function fulfillJson(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockCommonCatalog(page: Page) {
  await page.route("**/api/products?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const pageParam = Number(requestUrl.searchParams.get("page") ?? "1");
    return fulfillJson(route, 200, {
      products: pageParam === 1 ? [smokeProduct] : [],
      pagination: {
        page: pageParam,
        limit: 30,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
  });

  await page.route("**/api/products/*", async (route) => {
    return fulfillJson(route, 200, { product: smokeProduct });
  });
}

test("smoke: логин пользователя", async ({ page }) => {
  await mockCommonCatalog(page);

  await page.route("**/api/auth/me", async (route) => {
    return fulfillJson(route, 401, { message: "Unauthorized" });
  });
  await page.route("**/api/auth/login", async (route) => {
    return fulfillJson(route, 200, { user: smokeUser });
  });
  await page.route("**/api/wishlist", async (route) => {
    return fulfillJson(route, 200, { wishlist: [] });
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(smokeUser.email);
  await page.getByLabel("Пароль").fill("password123");
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: /^account$/i })).toBeVisible();
});

test("smoke: checkout happy-path", async ({ page }) => {
  let createOrderCalls = 0;
  let payCalls = 0;

  await mockCommonCatalog(page);

  await page.route("**/api/auth/me", async (route) => {
    return fulfillJson(route, 200, { user: smokeUser });
  });
  await page.route("**/api/wishlist", async (route) => {
    return fulfillJson(route, 200, { wishlist: [] });
  });
  await page.route("**/api/users/me/addresses", async (route) => {
    return fulfillJson(route, 200, {
      addresses: [
        {
          id: "addr-smoke-1",
          label: "Дом",
          country: "Россия",
          city: "Москва",
          street: "Тверская",
          house: "1",
          apartment: "10",
          postalCode: "125000",
          comment: null,
          isDefault: true,
        },
      ],
    });
  });
  await page.route("**/api/orders", async (route) => {
    if (route.request().method() === "GET") {
      return fulfillJson(route, 200, {
        orders: [
          {
            id: "order-smoke-1",
            totalRub: smokeProduct.priceRub,
            status: "AWAITING_PAYMENT",
            paymentStatus: "PENDING",
            deliveryLabel: "Дом",
            deliveryCountry: "Россия",
            deliveryCity: "Москва",
            deliveryStreet: "Тверская",
            deliveryHouse: "1",
            deliveryApartment: "10",
            deliveryPostalCode: "125000",
            deliveryComment: null,
            items: [
              {
                id: "item-smoke-1",
                brand: smokeProduct.brand,
                nameSnapshot: smokeProduct.name,
                qty: 1,
              },
            ],
          },
        ],
      });
    }
    createOrderCalls += 1;
    return fulfillJson(route, 200, {
      order: { id: "order-smoke-1" },
    });
  });
  await page.route("**/api/orders/order-smoke-1/pay", async (route) => {
    payCalls += 1;
    return fulfillJson(route, 200, { confirmationUrl: null });
  });
  await page.route("**/api/orders/order-smoke-1", async (route) => {
    return fulfillJson(route, 200, {
      order: { id: "order-smoke-1", paymentStatus: "PENDING" },
    });
  });

  await page.goto("/");
  await expect(page.locator(".product-card-link").first()).toBeVisible();
  await page.locator(".product-card-link").first().click();
  await page.getByRole("button", { name: "ADD TO BAG" }).click();
  await page.getByRole("link", { name: /bag \(1\)/i }).click();

  await expect(page.locator("#bag-address-select")).toHaveValue("addr-smoke-1");
  await page.getByRole("button", { name: "Proceed to Checkout" }).click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByText("Order: order-smoke-1")).toBeVisible();
  expect(createOrderCalls).toBe(1);
  expect(payCalls).toBe(1);
});

test("smoke: админ-фильтры заказов", async ({ page }) => {
  const calls: Array<{ sort: string; includeOpen: string; includeCompleted: string }> = [];

  await mockCommonCatalog(page);

  await page.route("**/api/auth/me", async (route) => {
    return fulfillJson(route, 200, { user: smokeAdmin });
  });
  await page.route("**/api/wishlist", async (route) => {
    return fulfillJson(route, 200, { wishlist: [] });
  });
  await page.route("**/api/admin/orders?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const sort = requestUrl.searchParams.get("sort") ?? "newest";
    const includeOpen = requestUrl.searchParams.get("includeOpen") ?? "true";
    const includeCompleted = requestUrl.searchParams.get("includeCompleted") ?? "true";
    calls.push({ sort, includeOpen, includeCompleted });

    const openOrder = {
      id: "open-1",
      createdAt: "2026-01-01T10:00:00.000Z",
      status: "AWAITING_PAYMENT",
      paymentStatus: "PENDING",
      totalRub: 1000,
      deliveryLabel: "Дом",
      deliveryCountry: "Россия",
      deliveryCity: "Москва",
      deliveryStreet: "Ленина",
      deliveryHouse: "5",
      deliveryApartment: null,
      deliveryPostalCode: null,
      deliveryComment: null,
      user: { email: "user@example.com", firstName: "Ivan", lastName: "Petrov" },
      items: [{ id: "oi-1", brand: "Brand", nameSnapshot: "Item 1", qty: 1, size: "M" }],
    };
    const doneOrder = {
      id: "done-1",
      createdAt: "2025-12-01T10:00:00.000Z",
      status: "PAID",
      paymentStatus: "SUCCEEDED",
      totalRub: 2000,
      deliveryLabel: "Офис",
      deliveryCountry: "Россия",
      deliveryCity: "Казань",
      deliveryStreet: "Баумана",
      deliveryHouse: "10",
      deliveryApartment: "12",
      deliveryPostalCode: "420000",
      deliveryComment: null,
      user: { email: "user2@example.com", firstName: "Anna", lastName: "Sidorova" },
      items: [{ id: "oi-2", brand: "Brand", nameSnapshot: "Item 2", qty: 2, size: "L" }],
    };

    const orders = [];
    if (includeOpen === "true") orders.push(openOrder);
    if (includeCompleted === "true") orders.push(doneOrder);
    if (sort === "oldest") orders.reverse();

    return fulfillJson(route, 200, { orders });
  });

  await page.goto("/admin/orders");

  await expect(page.getByText("Order open-1")).toBeVisible();
  await expect(page.getByText("Order done-1")).toBeVisible();

  await page.getByLabel("unfinished").uncheck();
  await expect(page.getByText("Order open-1")).toHaveCount(0);
  await expect(page.getByText("Order done-1")).toBeVisible();

  await page.getByLabel("sort").selectOption("oldest");
  await expect.poll(() => calls[calls.length - 1]?.sort).toBe("oldest");
});

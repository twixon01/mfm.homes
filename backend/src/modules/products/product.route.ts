import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";

import { env } from "../../config/env.js";
import { listProductsQuerySchema, productParamsSchema } from "./product.schema.js";

const CACHE_TTL_MS = 30_000;
const listProductsCache = new Map<string, { expiresAt: number; payload: unknown }>();
const USD_RATE_TTL_MS = 10 * 60 * 1000;
const EBAY_TIMEOUT_MS = 5000;

let usdRateCache: { rate: number; expiresAt: number } | null = null;
let ebayTokenCache: { token: string; expiresAt: number } | null = null;

export function invalidateProductsCache() {
  listProductsCache.clear();
}

function getCacheKey(query: {
  q?: string;
  category?: string;
  brands?: string;
  priceFrom?: number;
  priceTo?: number;
  page: number;
  limit: number;
  includeInactive: boolean;
}) {
  return JSON.stringify(query);
}

type EbayBrowseItem = {
  itemId?: string;
  title?: string;
  shortDescription?: string;
  price?: {
    value?: string;
    currency?: string;
  };
  image?: {
    imageUrl?: string;
  };
  itemWebUrl?: string;
  condition?: string;
  brand?: string;
  localizedAspects?: Array<{ name?: string; value?: string }>;
};

type EbayItemDetails = {
  description?: string;
  sizes?: string[];
};

function normalizeCategoryByTitle(title: string): "TOPS" | "OUTER" | "BOTTOMS" | "OTHER" {
  const normalized = title.toLowerCase();
  if (/(jeans|pants|shorts|trousers|denim|cargo|skirt)/.test(normalized)) return "BOTTOMS";
  if (/(jacket|coat|parka|hoodie|windbreaker|down|puffer|blazer)/.test(normalized)) return "OUTER";
  if (/(tee|t-shirt|shirt|polo|sweater|knit|tank|top|longsleeve)/.test(normalized)) return "TOPS";
  return "OTHER";
}

function normalizeBrandFromTitle(title: string) {
  const candidate = title.split(/[-|,/]/)[0]?.trim();
  return candidate ? candidate.slice(0, 80) : "eBay";
}

function extractSizesFromTextValues(values: string[]) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => value.split(/[,/;|]/))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

function extractSizesFromTitle(title: string) {
  const matches = title.match(/\b(?:XXS|XS|S|M|L|XL|XXL|XXXL)\b/gi) ?? [];
  return Array.from(new Set(matches.map((value) => value.toUpperCase())));
}

function toPlainText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundToNearest100(value: number) {
  return Math.max(0, Math.round(value / 100) * 100);
}

function calculateEbayPriceRubWithMarkup(baseRub: number) {
  const tierPercent =
    baseRub < 10_000
      ? 0.25
      : baseRub < 30_000
        ? 0.18
        : 0.12;

  const serviceMarkup = Math.max(baseRub * tierPercent, 1200);
  const fxBuffer = baseRub * 0.03;
  const operations = baseRub * 0.02;
  return roundToNearest100(baseRub + serviceMarkup + fxBuffer + operations);
}

async function getUsdRubRate() {
  if (usdRateCache && usdRateCache.expiresAt > Date.now()) {
    return usdRateCache.rate;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EBAY_TIMEOUT_MS);
    const response = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      return 95;
    }
    const payload = (await response.json()) as { Valute?: { USD?: { Value?: number } } };
    const rate = payload.Valute?.USD?.Value;
    if (!rate || !Number.isFinite(rate)) return 95;
    usdRateCache = { rate, expiresAt: Date.now() + USD_RATE_TTL_MS };
    return rate;
  } catch {
    return 95;
  }
}

async function getEbayAccessToken() {
  if (ebayTokenCache && ebayTokenCache.expiresAt > Date.now()) {
    return ebayTokenCache.token;
  }

  if (!env.EBAY_APP_ID || !env.EBAY_CLIENT_SECRET) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EBAY_TIMEOUT_MS);
    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.EBAY_APP_ID}:${env.EBAY_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    const token = payload.access_token;
    if (!token) return null;
    const ttlMs = Math.max(60, (payload.expires_in ?? 7200) - 60) * 1000;
    ebayTokenCache = { token, expiresAt: Date.now() + ttlMs };
    return token;
  } catch {
    return null;
  }
}

async function getEbayItemDetails(token: string, itemId: string) {
  try {
    const endpoint = `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(itemId)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EBAY_TIMEOUT_MS);
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": env.EBAY_MARKETPLACE,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      shortDescription?: string;
      description?: string;
      localizedAspects?: Array<{ name?: string; value?: string }>;
    };

    const sizeValues =
      payload.localizedAspects
        ?.filter((aspect) => (aspect.name ?? "").toLowerCase().includes("size"))
        .map((aspect) => aspect.value ?? "") ?? [];

    return {
      description: payload.description || payload.shortDescription,
      sizes: extractSizesFromTextValues(sizeValues),
    } satisfies EbayItemDetails;
  } catch {
    return null;
  }
}

async function searchEbayProducts(query: string, limit: number, page: number) {
  if (!query.trim()) {
    return { products: [] as any[], total: 0 };
  }

  const token = await getEbayAccessToken();
  if (!token) {
    return { products: [] as any[], total: 0 };
  }

  const endpoint = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", String(limit));
  endpoint.searchParams.set("offset", String(Math.max(0, (page - 1) * limit)));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EBAY_TIMEOUT_MS);
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": env.EBAY_MARKETPLACE,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      return { products: [] as any[], total: 0 };
    }

    const payload = (await response.json()) as {
      itemSummaries?: EbayBrowseItem[];
      total?: number;
    };
    const items = payload.itemSummaries ?? [];
    const totalEntries = payload.total ?? 0;
    const usdRubRate = await getUsdRubRate();

    const ebayMapped = await Promise.all(
      items.map(async (item) => {
        const itemId = item.itemId;
        const title = item.title;
        if (!itemId || !title) return null;

        const priceRaw = item.price?.value;
        const currency = item.price?.currency ?? "USD";
        const numericPrice = Number(priceRaw ?? 0);
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) return null;

        const baseRub = currency === "USD" ? numericPrice * usdRubRate : numericPrice;
        const priceRub = calculateEbayPriceRubWithMarkup(baseRub);
        const image = item.image?.imageUrl;
        const sourceUrl = item.itemWebUrl ?? null;
        const conditionText = item.condition?.toLowerCase() ?? "";
        const details = await getEbayItemDetails(token, itemId);
        const descriptionRaw = details?.description?.trim() || item.shortDescription?.trim() || title;
        const description = toPlainText(descriptionRaw) || title;
        const sizeAspects =
          item.localizedAspects
            ?.filter((aspect) => (aspect.name ?? "").toLowerCase().includes("size"))
            .map((aspect) => aspect.value ?? "")
            ?? [];
        const combinedSizes = [
          ...extractSizesFromTextValues(sizeAspects),
          ...(details?.sizes ?? []),
          ...extractSizesFromTitle(title),
        ];
        const sizes = Array.from(new Set(combinedSizes)).slice(0, 20);

        return {
          id: `ebay:${itemId}`,
          name: title.slice(0, 200),
          brand: (item.brand ?? normalizeBrandFromTitle(title)).slice(0, 80),
          description,
          priceRub,
          category: normalizeCategoryByTitle(title),
          sizes: sizes.length > 0 ? sizes : ["ONE SIZE"],
          condition: conditionText.includes("new") ? "NEW" : "USED",
          sourceType: "EXTERNAL",
          sourceName: "eBay",
          sourceUrl,
          images: image ? [image] : [],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }),
    );
    const products = ebayMapped.filter((item): item is NonNullable<(typeof ebayMapped)[number]> => Boolean(item));

    return { products, total: totalEntries };
  } catch {
    return { products: [] as any[], total: 0 };
  }
}

async function persistExternalProducts(
  app: any,
  products: Array<{
    id: string;
    name: string;
    brand: string;
    description: string;
    priceRub: number;
    category: "TOPS" | "OUTER" | "BOTTOMS" | "OTHER";
    sizes: string[];
    condition: "NEW" | "USED";
    sourceType: "EXTERNAL";
    sourceName: string;
    sourceUrl: string | null;
    images: string[];
    isActive: boolean;
  }>,
) {
  if (products.length === 0) return;
  await Promise.all(
    products.map((product) =>
      app.prisma.product.upsert({
        where: { id: product.id },
        update: {
          name: product.name,
          brand: product.brand,
          description: product.description,
          priceRub: product.priceRub,
          category: product.category,
          sizes: product.sizes,
          condition: product.condition,
          sourceType: product.sourceType,
          sourceName: product.sourceName,
          sourceUrl: product.sourceUrl,
          images: product.images,
          isActive: true,
        },
        create: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          description: product.description,
          priceRub: product.priceRub,
          category: product.category,
          sizes: product.sizes,
          condition: product.condition,
          sourceType: product.sourceType,
          sourceName: product.sourceName,
          sourceUrl: product.sourceUrl,
          images: product.images,
          isActive: true,
        },
      }),
    ),
  );
}

const productRoutes: FastifyPluginAsync = async (app) => {
  app.get("/products", async (request) => {
    const query = listProductsQuerySchema.parse(request.query);
    const priceFrom = query.priceFrom;
    const priceTo = query.priceTo;
    if (priceFrom !== undefined && priceTo !== undefined && priceFrom > priceTo) {
      throw app.httpErrors.badRequest("priceFrom не может быть больше priceTo");
    }

    const cacheKey = getCacheKey(query);
    const cached = listProductsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }

    const brandValues = query.brands
      ? query.brands
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    const where: Prisma.ProductWhereInput = {
      isActive: query.includeInactive ? undefined : true,
      sourceType: "INTERNAL",
      category: query.category,
      ...(brandValues.length > 0
        ? {
            OR: brandValues.map((brand) => ({ brand: { equals: brand, mode: "insensitive" as const } })),
          }
        : {}),
      priceRub: {
        gte: priceFrom,
        lte: priceTo,
      },
      AND: query.q
        ? [
            {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                { brand: { contains: query.q, mode: "insensitive" } },
                { description: { contains: query.q, mode: "insensitive" } },
              ],
            },
          ]
        : undefined,
    };

    const skip = (query.page - 1) * query.limit;
    const [internalProducts, internalTotal, ebayResult] = await Promise.all([
      app.prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      app.prisma.product.count({ where }),
      searchEbayProducts(query.q ?? "", query.limit, query.page),
    ]);

    let products = internalProducts;
    let total = internalTotal;

    if (query.q?.trim()) {
      const availableSlots = Math.max(0, query.limit - internalProducts.length);
      const ebaySlice = ebayResult.products.slice(0, availableSlots);
      await persistExternalProducts(app, ebaySlice);
      products = [...internalProducts, ...ebaySlice];
      total = internalTotal + ebayResult.total;
    }

    const totalPages = Math.max(1, Math.ceil(total / query.limit));
    const payload = {
      products,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    };
    if (listProductsCache.size > 300) {
      listProductsCache.clear();
    }
    listProductsCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return payload;
  });

  app.get("/products/:productId", async (request) => {
    const { productId } = productParamsSchema.parse(request.params);

    const product = await app.prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
      },
    });

    if (!product) {
      throw app.httpErrors.notFound("Товар не найден");
    }

    return { product };
  });
};

export default productRoutes;

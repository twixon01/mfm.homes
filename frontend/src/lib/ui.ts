import type { Category, OrderStatus } from "../types/domain";

export function categoryClass(category: Category) {
  return category.toLowerCase();
}

export function visualStyle(imageUrl?: string) {
  if (!imageUrl) return undefined;
  return {
    backgroundImage: `url("${encodeURI(imageUrl)}")`,
    backgroundSize: "contain",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  } as const;
}

export function formatPrice(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isTerminalOrderStatus(status: OrderStatus) {
  return status === "COMPLETED" || status === "CANCELLED";
}

export type Role = "USER" | "ADMIN";
export type Category = "TOPS" | "OUTER" | "BOTTOMS" | "OTHER";
export type SourceType = "INTERNAL" | "EXTERNAL";

export type User = {
  id: string;
  email: string;
  role: Role;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  description: string;
  priceRub: number;
  category: Category;
  sizes: string[];
  condition: "NEW" | "USED";
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string | null;
  images: string[];
  isActive: boolean;
};

export type ProductsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type ProductsListResponse = {
  products: Product[];
  pagination: ProductsPagination;
};

export type CartItem = {
  productId: string;
  size: string;
  qty: number;
};

export type OrderStatus = "CREATED" | "AWAITING_PAYMENT" | "PAID" | "PROCESSING" | "SHIPPED" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "CANCELED" | "FAILED";

export type OrderItem = {
  id: string;
  nameSnapshot: string;
  priceRub: number;
  qty: number;
  size: string | null;
  brand: string | null;
  imageUrl: string | null;
};

export type Order = {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalRub: number;
  shippingRub: number;
  totalRub: number;
  deliveryLabel: string | null;
  deliveryCountry: string;
  deliveryCity: string;
  deliveryStreet: string;
  deliveryHouse: string;
  deliveryApartment: string | null;
  deliveryPostalCode: string | null;
  deliveryComment: string | null;
  createdAt: string;
  items: OrderItem[];
};

export type AdminOrder = Order & {
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
};

export type WishlistApiItem = {
  productId: string;
};

export type Address = {
  id: string;
  userId: string;
  label: string | null;
  country: string;
  city: string;
  street: string;
  house: string;
  apartment: string | null;
  postalCode: string | null;
  comment: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductFormState = {
  name: string;
  brand: string;
  description: string;
  priceRub: string;
  category: Category;
  sizesText: string;
  condition: "NEW" | "USED";
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  imagesText: string;
  isActive: boolean;
};

export type AddressFormState = {
  label: string;
  country: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
  comment: string;
  isDefault: boolean;
};

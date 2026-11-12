import type Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export type Category = {
  id: string;
  name: string;
  icon: IconName;
  description: string;
  parentId?: string | null;
};

export type Store = {
  id: string;
  name: string;
  categoryIds: string[];
  description: string;
  location: string;
  rating?: number;
  deliveryTime?: string;
  deliveryFee?: string;
  featured?: boolean;
};

export type Product = {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  available: boolean;
  minimumQuantity?: number;
  quantityStep?: number;
  popular?: boolean;
  offer?: boolean;
  media?: ProductMedia[];
};

export type ProductMedia = {
  id: string;
  type: "image" | "video";
  uri: string;
  altText: string;
  displayOrder: number;
};


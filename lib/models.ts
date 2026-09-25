import type { ProductInfo } from './product-info';
export type Photo = { id: string; blob: Blob; width?: number; height?: number };
export type Note = {
  id: string;
  title: string;
  barcode?: string;
  productSource?: string;
  productInfo?: ProductInfo;
  rating: number | null;
  categoryId: string | null;
  date: string;
  comment: string;
  price: number | null;
  currency: string;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
  syncState: "local" | "pending";
};
export type Category = { id: string; name: string; color: string; createdAt: string; updatedAt?: string };
import type { ThemePreference } from "./themes";
export type { ThemePreference } from "./themes";
export type UserPreferences = { theme: ThemePreference; defaultCurrency: string };

export const INITIAL_CATEGORIES: Category[] = [
  { id: "food", name: "Food", color: "#C7A576", createdAt: "" },
  { id: "places", name: "Places", color: "#84A7A0", createdAt: "" },
  { id: "clothes", name: "Clothes", color: "#A793B2", createdAt: "" },
  { id: "beauty", name: "Beauty", color: "#C78D83", createdAt: "" },
  { id: "other", name: "Other", color: "#9FA7A5", createdAt: "" },
];
export const CATEGORY_COLORS = ["#C7A576", "#84A7A0", "#A793B2", "#C78D83", "#9FA7A5", "#9DAA82", "#B59B87", "#8D9EBA"];
export const DEFAULT_PREFERENCES: UserPreferences = { theme: "system", defaultCurrency: "EUR" };

export type Photo = { id: string; blob: Blob };
export type Note = {
  id: string;
  title: string;
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
export type Category = { id: string; name: string; color: string; createdAt: string };
export type ThemePreference = "system" | "light" | "dark" | "amoled";
export type UserPreferences = { theme: ThemePreference; defaultCurrency: string };

export const INITIAL_CATEGORIES: Category[] = [
  { id: "food", name: "Food", color: "#EBC984", createdAt: "" },
  { id: "places", name: "Places", color: "#A6D3D0", createdAt: "" },
  { id: "clothes", name: "Clothes", color: "#CBBBE4", createdAt: "" },
  { id: "beauty", name: "Beauty", color: "#E7B9AF", createdAt: "" },
  { id: "other", name: "Other", color: "#BAC5D4", createdAt: "" },
];
export const CATEGORY_COLORS = ["#EBC984", "#A6D3D0", "#CBBBE4", "#E7B9AF", "#BAC5D4", "#C4D6AA", "#D8BFA7", "#B9C9E6"];
export const DEFAULT_PREFERENCES: UserPreferences = { theme: "system", defaultCurrency: "EUR" };

import { z } from "zod";
export const idSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const timestamp = z.string().datetime().or(z.literal(""));
export const preferencesSchema = z.object({ theme: z.enum(["system", "light", "dark", "amoled"]), defaultCurrency: z.string().regex(/^[A-Z]{3}$/) }).strict();
export const categorySchema = z.object({ id: idSchema, name: z.string().trim().min(1).max(32), color: z.string().regex(/^#[a-fA-F0-9]{6}$/), createdAt: timestamp, updatedAt: timestamp.optional() }).strict();
export const photoSchema = z.object({ id: idSchema, mimeType: z.literal("image/jpeg"), width: z.number().int().positive().max(4096), height: z.number().int().positive().max(4096) }).strict();
export const noteSchema = z.object({ id: idSchema, title: z.string().trim().min(1).max(160), rating: z.number().int().min(1).max(5).nullable(), categoryId: idSchema.nullable(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s), comment: z.string().max(20000), price: z.number().finite().min(0).max(1e12).nullable(), currency: z.string().regex(/^[A-Z]{3}$/), photos: z.array(photoSchema).max(12), createdAt: timestamp, updatedAt: timestamp }).strict();
export const snapshotSchema = z.object({ notes: z.array(noteSchema).max(2000), categories: z.array(categorySchema).max(500), preferences: preferencesSchema }).strict().superRefine((data, ctx) => {
  const categories = new Set(data.categories.map(c => c.id)); const ids = new Set<string>();
  if (categories.size !== data.categories.length) ctx.addIssue({ code: "custom", message: "Duplicate category IDs" });
  for (const n of data.notes) {
    if (ids.has(n.id)) ctx.addIssue({ code: "custom", message: "Duplicate note IDs" }); ids.add(n.id);
    if (n.categoryId && !categories.has(n.categoryId)) ctx.addIssue({ code: "custom", message: "Missing category" });
    const photos = new Set(n.photos.map(p => p.id)); if (photos.size !== n.photos.length) ctx.addIssue({ code: "custom", message: "Duplicate photo IDs" });
  }
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export const emptySnapshot: Snapshot = { notes: [], categories: [], preferences: { theme: "system", defaultCurrency: "EUR" } };
export function normalizePrice(value: string): number | null {
  if (value === "") return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) throw new Error("Use a price such as 12.99 or 12,99");
  const price = Number(value.replace(",", ".")); if (!Number.isFinite(price) || price > 1e12) throw new Error("Price is too large"); return price;
}

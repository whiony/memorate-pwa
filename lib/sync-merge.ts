import { alignDefaultCategories, sameCategoryContent } from "./category-normalization.ts";
import type { Snapshot } from "./data-schema.ts";
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// Three-way merge: a deletion wins over an unchanged record, but concurrent
// edits never disappear. Keep the remote canonical ID and a local recovery copy.
export function mergeSnapshots(base: Snapshot, local: Snapshot, remote: Snapshot, newId: () => string): { snapshot: Snapshot; conflicts: number } {
  [base, local, remote] = alignDefaultCategories(base, local, remote);
  let conflicts = 0;
  const categories = [...remote.categories]; const categoryMap = new Map<string, string>();
  for (const c of local.categories) {
    const b = base.categories.find(x => x.id === c.id), r = remote.categories.find(x => x.id === c.id);
    if (sameCategoryContent(c, b) || sameCategoryContent(c, r)) continue;
    if (r && !sameCategoryContent(r, b) && !sameCategoryContent(c, r)) { const id = newId(); categories.push({ ...c, id }); categoryMap.set(c.id, id); conflicts++; }
    else { const i = categories.findIndex(x => x.id === c.id); if (i >= 0) categories[i] = c; else categories.push(c); }
  }
  for (const b of base.categories) if (!local.categories.some(c => c.id === b.id) && sameCategoryContent(remote.categories.find(c => c.id === b.id), b)) { const i = categories.findIndex(c => c.id === b.id); if (i >= 0) categories.splice(i, 1); }
  const notes = [...remote.notes];
  for (const note of local.notes) {
    const b = base.notes.find(x => x.id === note.id), r = remote.notes.find(x => x.id === note.id);
    if (equal(note, b) && !categoryMap.has(note.categoryId || "")) continue;
    const n = { ...note, categoryId: categoryMap.get(note.categoryId || "") || note.categoryId };
    if (!equal(r, b) && !equal(note, r)) { notes.push({ ...n, id: newId(), title: `${n.title.slice(0,140)} (recovered copy)` }); conflicts++; }
    else { const i = notes.findIndex(x => x.id === n.id); if (i >= 0) notes[i] = n; else notes.push(n); }
  }
  for (const b of base.notes) if (!local.notes.some(n => n.id === b.id) && equal(remote.notes.find(n => n.id === b.id), b)) { const i = notes.findIndex(n => n.id === b.id); if (i >= 0) notes.splice(i, 1); }
  const categoryIds = new Set(categories.map(c => c.id));
  const preferences = equal(local.preferences, base.preferences) ? remote.preferences : local.preferences;
  return { snapshot: { notes: notes.map(n => ({ ...n, categoryId: n.categoryId && categoryIds.has(n.categoryId) ? n.categoryId : null })), categories, preferences }, conflicts };
}

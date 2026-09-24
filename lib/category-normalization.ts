import { INITIAL_CATEGORIES, type Category } from './models.ts';

// The original Sites collection used this palette before the Rose Sand refresh.
const LEGACY_DEFAULT_COLORS: Record<string, string> = {
  food: '#ebc984', clothes: '#cbbbe4', beauty: '#e7b9af', places: '#a6d3d0', other: '#bac5d4',
};
// Only exact built-in names AND a known default color identify legacy defaults.
// Similar names, renamed defaults and custom colors are intentionally distinct.
function defaultKey(category: Category): string | undefined {
  return INITIAL_CATEGORIES.find(c => c.name.toLowerCase() === category.name.trim().toLowerCase() && [c.color.toLowerCase(), LEGACY_DEFAULT_COLORS[c.id]].includes(category.color.toLowerCase()))?.id;
}
export function sameCategoryContent(a: Category | undefined, b: Category | undefined): boolean {
  if (!a || !b) return a === b;
  return a.id === b.id && ((!!defaultKey(a) && defaultKey(a) === defaultKey(b)) || (a.name === b.name && a.color.toLowerCase() === b.color.toLowerCase()));
}
type CategoryData = { categories: Category[]; notes: { categoryId: string | null }[] };

// Align all three merge inputs before comparing notes, so repairing category IDs
// is not mistaken for a concurrent note edit. Never reuse an ID occupied by a
// genuinely different category in another input (e.g. a renamed default).
export function alignDefaultCategories<T extends CategoryData>(...inputs: T[]): T[] {
  const all = inputs.flatMap(input => input.categories);
  const targets = new Map<string, string>();
  for (const builtin of INITIAL_CATEGORIES) {
    const ids = [...new Set(all.filter(c => defaultKey(c) === builtin.id).map(c => c.id))];
    const safe = ids.filter(id => all.filter(c => c.id === id).every(c => defaultKey(c) === builtin.id));
    safe.sort((a,b) => a === builtin.id ? -1 : b === builtin.id ? 1 : a < b ? -1 : a > b ? 1 : 0);
    if (safe[0]) targets.set(builtin.id, safe[0]);
  }
  return inputs.map(input => {
    const aliases = new Map<string,string>();
    const categories: Category[] = [];
    // Retain the chosen record's metadata rather than synthesizing timestamps.
    const ordered = [...input.categories].sort((a,b) => {
      const aTarget = targets.get(defaultKey(a) || '') === a.id;
      const bTarget = targets.get(defaultKey(b) || '') === b.id;
      return Number(bTarget) - Number(aTarget) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    for (const category of ordered) {
      const key = defaultKey(category), id = key ? targets.get(key) || category.id : category.id;
      aliases.set(category.id, id);
      if (!categories.some(c => c.id === id)) categories.push({ ...category, id });
    }
    return { ...input, categories, notes: input.notes.map(note => ({ ...note, categoryId: note.categoryId ? aliases.get(note.categoryId) || note.categoryId : null })) } as T;
  });
}

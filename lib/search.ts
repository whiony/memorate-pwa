import { Category, Note } from "./models";

const CYRILLIC: Record<string, string> = {
  а:"a", б:"b", в:"v", г:"g", ґ:"g", д:"d", е:"e", є:"ye", ё:"yo", ж:"zh", з:"z", и:"i", і:"i", ї:"yi", й:"y", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f", х:"kh", ц:"ts", ч:"ch", ш:"sh", щ:"shch", ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya",
};
const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split("").map(char => CYRILLIC[char] ?? char).join("").replace(/[^a-z0-9]+/g, " ").trim();

function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = next;
    if (Math.min(...prev) > max) return max + 1;
  }
  return prev[b.length];
}

export function matchesNote(note: Note, categories: Category[], query: string): boolean {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const category = categories.find(item => item.id === note.categoryId)?.name || "uncategorized";
  const haystack = normalize(`${note.title} ${category} ${note.comment}`);
  const words = haystack.split(" ");
  return terms.every(term => haystack.includes(term) || words.some(word => {
    if (word.startsWith(term)) return true;
    const max = term.length >= 5 ? 2 : term.length >= 4 ? 1 : 0;
    return max > 0 && distance(term, word.slice(0, Math.max(term.length, Math.min(word.length, term.length + 1))), max) <= max;
  }));
}

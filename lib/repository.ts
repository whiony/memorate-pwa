import { alignDefaultCategories, sameCategoryContent } from "./category-normalization.ts";
import { DEFAULT_PREFERENCES, INITIAL_CATEGORIES, type Category, type Note, type UserPreferences } from "./models.ts";
import { newId } from "./id.ts";
import { snapshotSchema, type Snapshot } from "./data-schema.ts";

export interface NoteRepository { notes(): Promise<Note[]>; saveNote(note: Note, original?: Note): Promise<Note>; deleteNote(id: string): Promise<unknown> }
export interface CategoryRepository { categories(): Promise<Category[]>; saveCategory(category: Category): Promise<unknown>; deleteCategory(id: string): Promise<void> }
export interface UserPreferencesRepository { preferences(): Promise<UserPreferences>; savePreferences(value: UserPreferences): Promise<unknown> }
export interface PhotoStorage { getPhoto(id: string): Promise<Blob | undefined> }
export type SyncMetadata = { owner: string; base: Snapshot; syncedAt?: string };
let connection: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open("memorate", 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const name of ["notes", "categories", "preferences", "metadata"]) if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath: name === "notes" || name === "categories" ? "id" : "key" });
    };
    request.onsuccess = () => { const database = request.result; database.onversionchange = () => { database.close(); connection = undefined; }; resolve(database); };
    request.onerror = () => { connection = undefined; reject(request.error); };
    request.onblocked = () => { connection = undefined; reject(new Error("Close other Memorate tabs and retry the storage upgrade.")); };
  }); return connection;
}
async function read<T>(store: string, key?: string): Promise<T> {
  const database = await db(); return new Promise((resolve, reject) => { const tx = database.transaction(store); const request = key === undefined ? tx.objectStore(store).getAll() : tx.objectStore(store).get(key); tx.oncomplete = () => resolve(request.result); tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); });
}
async function mutate(work: (tx: IDBTransaction) => void): Promise<void> {
  const database = await db(); return new Promise((resolve, reject) => {
    const tx = database.transaction(["notes", "categories", "preferences", "metadata"], "readwrite");
    const revision = tx.objectStore("metadata").get("generation");
    revision.onsuccess = () => tx.objectStore("metadata").put({ key: "generation", value: (revision.result?.value || 0) + 1 });
    work(tx); tx.oncomplete = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("memorate-change")); resolve(); }; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error("Local data changed during synchronization; retry."));
  });
}
export const repository = {
  async initialize() {
    const database = await db();
    await new Promise<void>((resolve,reject) => {
      const tx = database.transaction(["notes","categories","preferences","metadata"], "readwrite");
      const initialized = tx.objectStore("preferences").get("initialized");
      const request = tx.objectStore("categories").getAll();
      let changed = false;
      request.onsuccess = () => {
        const existing: Category[] = request.result;
        const [repaired] = alignDefaultCategories({ categories: existing, notes: existing.map(c => ({categoryId:c.id})) });
        const aliases = new Map(existing.map((c,i) => [c.id,repaired.notes[i].categoryId!]));
        if (!initialized.result) {
          if (!existing.length) for (const c of INITIAL_CATEGORIES) tx.objectStore("categories").put(c);
          tx.objectStore("preferences").put({key:"initialized",value:true}); changed = true;
        }
        const removed = existing.filter(c => aliases.get(c.id) !== c.id);
        if (removed.length) {
          changed = true;
          for (const c of repaired.categories) tx.objectStore("categories").put(c);
          const cursor = tx.objectStore("notes").openCursor();
          cursor.onsuccess = () => {
            const row = cursor.result; if (!row) return;
            const target = aliases.get(row.value.categoryId);
            if (target && target !== row.value.categoryId) row.update({...row.value,categoryId:target});
            row.continue();
          };
          for (const c of removed) tx.objectStore("categories").delete(c.id);
        }
        if (changed) { const gen = tx.objectStore("metadata").get("generation"); gen.onsuccess = () => tx.objectStore("metadata").put({key:"generation",value:(gen.result?.value||0)+1}); }
      };
      tx.oncomplete = () => { if (changed && typeof window !== "undefined") window.dispatchEvent(new Event("memorate-change")); resolve(); };
      tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    return { notes: await this.notes(), categories: await this.categories(), preferences: await this.preferences() };
  },
  notes: () => read<Note[]>("notes"),
  categories: () => read<Category[]>("categories"),
  preferences: async () => (await read<{value:UserPreferences} | undefined>("preferences", "user"))?.value || DEFAULT_PREFERENCES,
  async saveNote(note: Note, original?: Note): Promise<Note> {
    let saved = note;
    await mutate(tx => {
      const store = tx.objectStore("notes");
      if (!original) { store.put(saved); return; }
      const current = store.get(original.id);
      current.onsuccess = () => {
        // A remote edit/delete can arrive while a form is open. Compare and save
        // in one transaction, retaining the remote version and the user's draft.
        if (!current.result || current.result.updatedAt !== original.updatedAt) saved = { ...note, id: newId(), title: `${note.title.slice(0,140)} (recovered copy)` };
        store.put(saved);
      };
    });
    return saved;
  },
  deleteNote: (id: string) => mutate(tx => { tx.objectStore("notes").delete(id); }),
  async saveCategory(category: Category) {
    const existing = await read<Category | undefined>("categories", category.id);
    if (sameCategoryContent(existing, category)) return;
    await mutate(tx => tx.objectStore("categories").put({ ...category, updatedAt: new Date().toISOString() }));
  },
  deleteCategory: (id: string) => mutate(tx => { tx.objectStore("categories").delete(id); const request = tx.objectStore("notes").openCursor(); request.onsuccess = () => { const cursor = request.result; if (!cursor) return; if (cursor.value.categoryId === id) cursor.update({ ...cursor.value, categoryId: null, updatedAt: new Date().toISOString() }); cursor.continue(); }; }),
  savePreferences: (value: UserPreferences) => mutate(tx => tx.objectStore("preferences").put({ key: "user", value })),
  async getPhoto(id: string) { for (const note of await this.notes()) { const photo = note.photos.find(p => p.id === id); if (photo) return photo.blob; } },
  async snapshot(): Promise<{ data: Snapshot; blobs: Map<string, Blob>; generation: number }> {
    // One readonly transaction gives a consistent view, including its generation.
    const database = await db();
    const values = await new Promise<{ notes: Note[]; categories: Category[]; preferences: UserPreferences; generation: number }>((resolve, reject) => { const tx = database.transaction(["notes", "categories", "preferences", "metadata"]); const notes = tx.objectStore("notes").getAll(), categories = tx.objectStore("categories").getAll(), prefs = tx.objectStore("preferences").get("user"), gen = tx.objectStore("metadata").get("generation"); tx.oncomplete = () => resolve({ notes: notes.result, categories: categories.result, preferences: prefs.result?.value || DEFAULT_PREFERENCES, generation: gen.result?.value || 0 }); tx.onabort = () => reject(tx.error); });
    const blobs = new Map<string, Blob>();
    const notes = values.notes.map(({ syncState: _syncState, ...note }) => ({ ...note, photos: note.photos.map(photo => { blobs.set(photo.id, photo.blob); return { id: photo.id, mimeType: "image/jpeg" as const, width: photo.width ?? 1000, height: photo.height ?? 1000 }; }) }));
    return { data: snapshotSchema.parse({ notes, categories: values.categories.map(c => ({ ...c, updatedAt: c.updatedAt ?? c.createdAt })), preferences: values.preferences }), blobs, generation: values.generation };
  },
  syncMetadata: async () => (await read<{ value: SyncMetadata } | undefined>("metadata", "sync"))?.value,
  setSyncMetadata: (value: SyncMetadata) => mutate(tx => tx.objectStore("metadata").put({ key: "sync", value })),
  async replaceSnapshot(data: Snapshot, blobs: Map<string, Blob>, expectedGeneration: number, sync?: SyncMetadata) {
    snapshotSchema.parse(data);
    [data] = alignDefaultCategories(data);
    const notes = data.notes.map(n => ({ ...n, syncState: "local", photos: n.photos.map(p => { const blob = blobs.get(p.id); if (!blob) throw new Error("A photo is missing. No data was changed."); return { id: p.id, blob, width: p.width, height: p.height }; }) }));
    await mutate(tx => { const check = tx.objectStore("metadata").get("generation"); check.onsuccess = () => { if ((check.result?.value || 0) !== expectedGeneration) { tx.abort(); return; } tx.objectStore("notes").clear(); tx.objectStore("categories").clear(); for (const n of notes) tx.objectStore("notes").put(n); for (const c of data.categories) tx.objectStore("categories").put(c); tx.objectStore("preferences").put({ key: "user", value: data.preferences }); if (sync) tx.objectStore("metadata").put({ key: "sync", value: sync }); }; });
  },
};

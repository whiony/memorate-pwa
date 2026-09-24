import { Category, DEFAULT_PREFERENCES, INITIAL_CATEGORIES, Note, UserPreferences } from "./models";

const DB_NAME = "memorate";
const DB_VERSION = 1;
let connection: Promise<IDBDatabase> | undefined;

function db(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("notes", { keyPath: "id" });
      database.createObjectStore("categories", { keyPath: "id" });
      database.createObjectStore("preferences", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return connection;
}

async function transact<T>(store: string, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, mode);
    const request = work(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const repository = {
  async initialize() {
    const categories = await this.categories();
    const initialized = await transact<{ key: string; value: boolean } | undefined>("preferences", "readonly", s => s.get("initialized"));
    if (!initialized) {
      if (categories.length === 0) for (const category of INITIAL_CATEGORIES) await this.saveCategory(category);
      await transact("preferences", "readwrite", s => s.put({ key: "initialized", value: true }));
    }
    return { notes: await this.notes(), categories: await this.categories(), preferences: await this.preferences() };
  },
  notes: () => transact<Note[]>("notes", "readonly", s => s.getAll()),
  categories: () => transact<Category[]>("categories", "readonly", s => s.getAll()),
  preferences: async () => (await transact<{ key: string; value: UserPreferences } | undefined>("preferences", "readonly", s => s.get("user")))?.value || DEFAULT_PREFERENCES,
  saveNote: (note: Note) => transact("notes", "readwrite", s => s.put(note)),
  deleteNote: (id: string) => transact("notes", "readwrite", s => s.delete(id)),
  saveCategory: (category: Category) => transact("categories", "readwrite", s => s.put(category)),
  async deleteCategory(id: string) {
    const database = await db();
    return new Promise<void>((resolve, reject) => {
      const tx = database.transaction(["categories", "notes"], "readwrite");
      tx.objectStore("categories").delete(id);
      const notes = tx.objectStore("notes");
      notes.openCursor().onsuccess = event => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (!cursor) return;
        if ((cursor.value as Note).categoryId === id) cursor.update({ ...cursor.value, categoryId: null, updatedAt: new Date().toISOString() });
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  savePreferences: (value: UserPreferences) => transact("preferences", "readwrite", s => s.put({ key: "user", value })),
};

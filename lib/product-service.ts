import { resolveProducts } from './product-resolution.ts';
import { normalizeBarcode } from './barcode.ts';
import { LookupError, type Product, type ProductLookupProvider } from './product-lookup.ts';
export type CachedProduct = { product: Product; fetchedAt: number; expiresAt: number };
export interface ProductStore {
  get(barcode: string): Promise<CachedProduct | null>;
  put(value: CachedProduct): Promise<void>;
  /** Atomically reserve provider quota; return seconds until retry if unavailable. */
  reserve(provider: string, now: number): Promise<number>;
  pause(provider: string, until: number): Promise<void>;
}
export type LookupDiagnostic = { barcode: string; provider: string; outcome: string; durationMs: number; error?: string };
export class ProductLookupService implements ProductLookupProvider {
  readonly id = 'product-search';
  private providers: ProductLookupProvider[];
  private store: ProductStore;
  private clock: () => number;
  private log: (event: LookupDiagnostic) => void;
  constructor(providers: ProductLookupProvider[], store: ProductStore, clock = Date.now, log: (event: LookupDiagnostic) => void = () => {}) {
    this.providers = providers; this.store = store; this.clock = clock; this.log = log;
  }
  async lookup(input: string, signal?: AbortSignal): Promise<Product | null> {
    const barcode = normalizeBarcode(input); if (!barcode) throw new Error('Invalid retail barcode');
    const cached = await this.store.get(barcode);
    if (cached && cached.product.resolutionVersion === 3 && cached.expiresAt > this.clock()) { this.log({barcode,provider:cached.product.source,outcome:'cache-hit',durationMs:0}); return cached.product; }
    let failure: Error | undefined;
    const results: Product[]=[];
    for (const provider of this.providers) {
      signal?.throwIfAborted();
      if(provider.supports&&!provider.supports(barcode))continue;
      const start = this.clock();
      try {
        const wait = await this.store.reserve(provider.id,start);
        if (wait) throw new LookupError('Product search is busy. Try again shortly or continue manually.',429,wait);
        const product = await provider.lookup(barcode,signal);
        this.log({barcode,provider:provider.id,outcome:product ? 'found' : 'not-found',durationMs:this.clock()-start});
        if (product) results.push(product);
      } catch (error) {
        signal?.throwIfAborted();
        const current = error instanceof Error ? error : new Error('Lookup failed');
        this.log({barcode,provider:provider.id,outcome:'error',durationMs:this.clock()-start,error:current.message});
        if (current instanceof LookupError && current.status === 429) {
          await this.store.pause(provider.id,this.clock()+current.retryAfter*1000);
          if (!failure || !(failure instanceof LookupError) || failure.retryAfter < current.retryAfter) failure=current;
        } else if (!failure) failure=current;
      }
    }
    const resolved=resolveProducts(results,'en');
    if(resolved){const now=this.clock();await this.store.put({product:resolved,fetchedAt:now,expiresAt:now+(failure?15*60000:7*86400000)});return resolved;}
    // A partial outage isn't proof that no database contains this product.
    if (failure) throw failure;
    return null;
  }
}

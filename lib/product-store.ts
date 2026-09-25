import type { CachedProduct, ProductStore } from './product-service.ts';
export class D1ProductStore implements ProductStore {
  private db: D1Database;
  constructor(db: D1Database) { this.db=db; }
  async get(barcode: string): Promise<CachedProduct | null> {
    const row=await this.db.prepare('SELECT product_json, fetched_at, expires_at FROM product_lookup_cache WHERE barcode = ?').bind(barcode).first<{product_json:string;fetched_at:number;expires_at:number}>();
    return row ? {product:JSON.parse(row.product_json),fetchedAt:row.fetched_at,expiresAt:row.expires_at} : null;
  }
  async put(value: CachedProduct) {
    await this.db.batch([
      this.db.prepare('INSERT INTO product_lookup_cache (barcode,product_json,fetched_at,expires_at) VALUES (?,?,?,?) ON CONFLICT(barcode) DO UPDATE SET product_json=excluded.product_json,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at').bind(value.product.barcode,JSON.stringify(value.product),value.fetchedAt,value.expiresAt),
      this.db.prepare('DELETE FROM product_lookup_cache WHERE expires_at < ?').bind(value.fetchedAt),
    ]);
  }
  async reserve(provider: string, now: number) {
    const day=new Date(now).toISOString().slice(0,10), interval=provider==='upcitemdb'?11000:2500, daily=provider==='upcitemdb'?100:100000;
    const row=await this.db.prepare(`INSERT INTO product_provider_budget (provider,day,requests,next_at) VALUES (?,?,1,?)
      ON CONFLICT(provider) DO UPDATE SET day=excluded.day, requests=CASE WHEN product_provider_budget.day=excluded.day THEN product_provider_budget.requests+1 ELSE 1 END,next_at=excluded.next_at
      WHERE product_provider_budget.next_at<=? AND (product_provider_budget.day<>excluded.day OR product_provider_budget.requests<?) RETURNING provider`).bind(provider,day,now+interval,now,daily).first();
    if(row)return 0;
    const state=await this.db.prepare('SELECT day,requests,next_at FROM product_provider_budget WHERE provider=?').bind(provider).first<{day:string;requests:number;next_at:number}>();
    const until=state?.day===day && state.requests>=daily ? Date.parse(`${day}T00:00:00Z`)+86400000 : state?.next_at || now+interval;
    return Math.max(1,Math.ceil((until-now)/1000));
  }
  async pause(provider: string, until: number) {
    await this.db.prepare('UPDATE product_provider_budget SET next_at=MAX(next_at,?) WHERE provider=?').bind(until,provider).run();
  }
}

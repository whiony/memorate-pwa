declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    GO_UPC_API_KEY?: string;
    BUCKET?: R2Bucket;
  }
}

import handler from "vinext/server/fetch-handler";

// Apply at the Worker boundary: Vinext's streamed root response can omit
// next.config headers even when error responses include them.
const worker = {
  async fetch(...args: Parameters<typeof handler.fetch>) {
    const response = await handler.fetch(...args);
    const secured = new Response(response.body, response);
    const path = new URL(args[0].url);
    // Root SSR is deliberately identity-free: all collection/account state is
    // loaded client-side. Do not retain this marker if personalized SSR is added.
    if (path.pathname === "/" && !path.search && secured.status === 200 && secured.headers.get("Content-Type")?.includes("text/html")) secured.headers.set("X-Memorate-Offline-Shell", "1");
    if (path.pathname === "/sw.js") secured.headers.set("Cache-Control", "no-cache");
    secured.headers.delete("X-Powered-By");
    secured.headers.set("X-Content-Type-Options", "nosniff");
    secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    secured.headers.set("Content-Security-Policy", "object-src 'none'; base-uri 'self'; form-action 'self'");
    return secured;
  },
};

export default worker;

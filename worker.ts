import handler from "vinext/server/fetch-handler";

// Apply at the Worker boundary: Vinext's streamed root response can omit
// next.config headers even when error responses include them.
export default {
  async fetch(...args: Parameters<typeof handler.fetch>) {
    const response = await handler.fetch(...args);
    const secured = new Response(response.body, response);
    secured.headers.delete("X-Powered-By");
    secured.headers.set("X-Content-Type-Options", "nosniff");
    secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    secured.headers.set("Content-Security-Policy", "object-src 'none'; base-uri 'self'; form-action 'self'");
    return secured;
  },
};

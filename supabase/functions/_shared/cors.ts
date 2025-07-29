// functions/_shared/cors.ts
export function isPreflight(req: Request): boolean {
  return req.method === "OPTIONS";
}

export function handleCors(req: Request, res?: Response): Response {
  const headers = new Headers(res?.headers || {});
  headers.set("Access-Control-Allow-Origin", "*"); // ou o domínio exato
  headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers,
    });
  }

  return new Response(res?.body, {
    status: res?.status || 200,
    headers,
  });
}

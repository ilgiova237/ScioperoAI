// Backend di test senza dipendenze
Deno.serve((_req) => new Response(JSON.stringify({ status: "ok", message: "Backend senza Oak funziona!" }), {
  headers: { "content-type": "application/json" },
}));
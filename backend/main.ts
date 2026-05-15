const API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const MODEL = "meta-llama/llama-3-8b-instruct";

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" } });

  try {
    // Health check
    if (path === "/" && method === "GET") {
      return json({ status: "ok", message: "ScioperoScan AI backend attivo con OpenRouter" });
    }

    // Debug
    if (path === "/debug/env" && method === "GET") {
      return json({ API_KEY_exists: !!API_KEY, API_KEY_length: API_KEY.length });
    }

    // Analisi documento
    if (path === "/api/analyze" && method === "POST") {
      const { text } = await req.json();
      if (!text || text.length < 50) {
        return json({ error: "Testo troppo corto" }, 400);
      }
      if (!API_KEY) {
        return json({ error: "API Key non configurata" }, 500);
      }

      const prompt = `Sei un analista sindacale esperto del comparto Istruzione italiano. Analizza il seguente documento di sciopero e produci un report dettagliato in italiano con: probabilità di successo (ALTA/MEDIA/BASSA), punti di forza, criticità, base giuridica, confronto storico, consigli tattici.\n\nDocumento:\n${text}`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://sciperoscan.pages.dev",
          "X-Title": "ScioperoScan AI"
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 4096
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.choices?.[0]?.message?.content || "Nessuna analisi prodotta.";
      return json({ analysis, probability: "MEDIA" });
    }

    // Storico (mock)
    if (path === "/api/history" && method === "GET") {
      return json([]);
    }

    // Admin verify
    if (path === "/api/admin/verify" && method === "POST") {
      const { password } = await req.json();
      if (password === "sciopero2024") {
        return json({ token: "admin-token" });
      }
      return json({ error: "Password errata" }, 401);
    }

    // Admin settings (mock)
    if (path === "/api/admin/settings" && method === "PUT") {
      return json({ success: true });
    }

    return json({ error: "Endpoint non trovato" }, 404);

  } catch (err) {
    console.error("Errore:", err.message);
    return json({ error: "Internal Server Error", message: err.message }, 500);
  }
}

Deno.serve(handler);
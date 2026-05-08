// ScioperoScan AI – Backend con Deno.serve (nessuna dipendenza esterna)
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "default-secret";

// ========================
// ROUTER MANUALE
// ========================
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Log di debug
  console.log(`[${method}] ${path}`);

  // CORS headers per tutte le risposte
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });

  // Gestione preflight CORS
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // Helper per risposte JSON
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" } });

  try {
    // --------------------------
    // ROTTE
    // --------------------------

    // Health check
    if (path === "/" && method === "GET") {
      return json({ status: "ok", message: "ScioperoScan AI backend attivo", timestamp: new Date().toISOString() });
    }

    // Debug variabili d'ambiente
    if (path === "/debug/env" && method === "GET") {
      return json({
        GEMINI_API_KEY_exists: !!GEMINI_API_KEY,
        GEMINI_API_KEY_length: GEMINI_API_KEY.length,
        JWT_SECRET_exists: !!JWT_SECRET,
        JWT_SECRET_length: JWT_SECRET.length,
      });
    }

    // Analisi documento (endpoint principale)
    if (path === "/api/analyze" && method === "POST") {
      const body = await req.json();
      const text = body.text || "";
      if (!text || text.length < 50) {
        return json({ error: "Testo troppo corto" }, 400);
      }
      if (!GEMINI_API_KEY) {
        return json({ error: "API Key Gemini non configurata" }, 500);
      }

      // Chiamata a Gemini
      const prompt = `Sei un analista sindacale esperto del comparto Istruzione italiano. Analizza il seguente documento di sciopero e produci un report dettagliato con: probabilità di successo, punti di forza, criticità, base giuridica, confronto storico, consigli tattici.\n\nDocumento:\n${text}`;
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
          }),
        }
      );
      if (!geminiRes.ok) {
        const err = await geminiRes.json().catch(() => ({}));
        throw new Error(`Errore API Gemini: ${err.error?.message || geminiRes.status}`);
      }
      const geminiData = await geminiRes.json();
      const analysis = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Nessuna analisi prodotta.";
      return json({ analysis, probability: "MEDIA" }); // La probabilità verrà calcolata dal frontend
    }

    // Storico (semplice array in memoria, temporaneo)
    if (path === "/api/history" && method === "GET") {
      return json([]); // Per ora vuoto
    }

    // Admin: verifica password (semplice)
    if (path === "/api/admin/verify" && method === "POST") {
      const { password } = await req.json();
      // Password temporanea: "sciopero2024" (hash simulato)
      if (password === "sciopero2024") {
        return json({ token: "admin-token-temporaneo" });
      }
      return json({ error: "Password errata" }, 401);
    }

    // Admin: salva impostazioni (solo API Key per ora)
    if (path === "/api/admin/settings" && method === "PUT") {
      // In un'implementazione reale useremmo KV, per ora logghiamo e basta
      const body = await req.json();
      console.log("Nuove impostazioni:", body);
      return json({ success: true });
    }

    // Volantino (mock)
    if (path === "/api/volantino" && method === "POST") {
      const { analysis } = await req.json();
      const volantino = `Compagne e compagni,\n\n${analysis?.substring(0, 500)}...\n\nUniamoci!`;
      return json({ volantino });
    }

    // 404
    return json({ error: "Endpoint non trovato" }, 404);

  } catch (err) {
    console.error("Errore:", err.message);
    return json({ error: "Internal Server Error", message: err.message }, 500);
  }
}

// Avvia il server
console.log("Backend avviato con Deno.serve");
Deno.serve(handler);
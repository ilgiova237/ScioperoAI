import { Application, Router } from "oak";

const app = new Application();
const router = new Router();

// Middleware di debug globale
app.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`[DEBUG] --> ${ctx.request.method} ${ctx.request.url.pathname}`);
  try {
    await next();
    const ms = Date.now() - start;
    console.log(`[DEBUG] <-- ${ctx.request.method} ${ctx.request.url.pathname} ${ctx.response.status} (${ms}ms)`);
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`[ERROR] ${ctx.request.method} ${ctx.request.url.pathname} dopo ${ms}ms:`, err.message);
    console.error("[ERROR] Stack:", err.stack);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal Server Error",
      message: err.message || "Errore sconosciuto",
      stack: err.stack || "",
    };
  }
});

// CORS
app.use(async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  await next();
});

// Endpoint di debug per variabili d'ambiente
router.get("/debug/env", (ctx) => {
  ctx.response.body = {
    GEMINI_API_KEY_exists: Deno.env.has("GEMINI_API_KEY"),
    GEMINI_API_KEY_length: Deno.env.get("GEMINI_API_KEY")?.length || 0,
    JWT_SECRET_exists: Deno.env.has("JWT_SECRET"),
    JWT_SECRET_length: Deno.env.get("JWT_SECRET")?.length || 0,
    PORT: Deno.env.get("PORT") || "non impostata",
  };
});

// Endpoint di test per Gemini (senza KV, senza admin)
router.post("/api/test-gemini", async (ctx) => {
  const { text } = await ctx.request.body({ type: "json" }).value;
  if (!text) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Manca il testo" };
    return;
  }
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    ctx.response.status = 500;
    ctx.response.body = { error: "GEMINI_API_KEY non impostata" };
    return;
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: "Analizza questo testo di sciopero: " + text }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Errore API Gemini: ${err.error?.message || response.status}`);
    }
    const data = await response.json();
    ctx.response.body = { analysis: data.candidates[0].content.parts[0].text };
  } catch (e) {
    ctx.response.status = 500;
    ctx.response.body = { error: e.message };
  }
});

// Health check
router.get("/", (ctx) => {
  ctx.response.body = { status: "ok", message: "ScioperoScan AI backend unificato" };
});

app.use(router.routes());
app.use(router.allowedMethods());

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`Server unificato in ascolto sulla porta ${port}`);
Deno.serve(app.handle.bind(app));
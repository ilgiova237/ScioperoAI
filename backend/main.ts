import { Application, Router } from "oak";

const app = new Application();
const router = new Router();

const API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const MODEL = "meta-llama/llama-3-8b-instruct";
const ADMIN_PASSWORD = "sciopero2024";
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "segretissimo";

// Inizializzazione KV
const kv = await Deno.openKv();

// Middleware CORS e logging
app.use(async (ctx, next) => {
  const start = Date.now();
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  try {
    await next();
    console.log(`[${ctx.request.method}] ${ctx.request.url.pathname} - ${ctx.response.status} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`[ERROR] ${ctx.request.method} ${ctx.request.url.pathname}:`, err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error", message: err.message };
  }
});

// Health check
router.get("/", (ctx) => {
  ctx.response.body = { status: "ok", message: "ScioperoScan AI con OpenRouter" };
});

// Debug variabili d'ambiente
router.get("/debug/env", (ctx) => {
  ctx.response.body = {
    API_KEY_exists: !!API_KEY,
    API_KEY_length: API_KEY.length,
    KV_available: true,
  };
});

// Analisi documento (OpenRouter)
router.post("/api/analyze", async (ctx) => {
  const { text } = await ctx.request.body({ type: "json" }).value;
  if (!text || text.length < 50) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Testo troppo corto" };
    return;
  }
  if (!API_KEY) {
    ctx.response.status = 500;
    ctx.response.body = { error: "API Key non configurata" };
    return;
  }

  const prompt = `Sei un analista sindacale esperto del comparto Istruzione italiano. Analizza il seguente documento di sciopero e le informazioni contestuali aggiuntive. Produci un report dettagliato in italiano con: probabilità di successo (ALTA/MEDIA/BASSA), punti di forza, criticità, base giuridica, confronto storico, consigli tattici.\n\nDOCUMENTO:\n${text}`;

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
  ctx.response.body = { analysis, probability: "MEDIA" };
});

// Storico (mock)
router.get("/api/history", (ctx) => {
  ctx.response.body = [];
});

// ========================
// ROTTE ADMIN
// ========================

// Middleware di autenticazione admin (token semplice = password)
async function authAdmin(ctx: any, next: any) {
  const token = ctx.request.headers.get("Authorization")?.replace("Bearer ", "");
  if (token === ADMIN_PASSWORD) {
    await next();
  } else {
    ctx.response.status = 401;
    ctx.response.body = { error: "Non autorizzato" };
  }
}

// Verifica password (restituisce token semplice)
router.post("/api/admin/verify", async (ctx) => {
  const { password } = await ctx.request.body({ type: "json" }).value;
  if (password === ADMIN_PASSWORD) {
    ctx.response.body = { token: ADMIN_PASSWORD };
  } else {
    ctx.response.status = 401;
    ctx.response.body = { error: "Password errata" };
  }
});

// GET: ottieni tutti i professori (protetto da auth)
router.get("/api/admin/professori", authAdmin, async (ctx) => {
  const iter = kv.list({ prefix: ["professori"] });
  const professori = [];
  for await (const entry of iter) {
    professori.push(entry.value);
  }
  ctx.response.body = professori;
});

// POST: aggiungi un professore
router.post("/api/admin/professori", authAdmin, async (ctx) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const { nome, materia, caratteristiche } = body;
  if (!nome || !materia) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Nome e materia obbligatori" };
    return;
  }
  const id = crypto.randomUUID();
  const prof = { id, nome, materia, caratteristiche: caratteristiche || "" };
  await kv.set(["professori", id], prof);
  ctx.response.status = 201;
  ctx.response.body = prof;
});

// PUT: modifica un professore
router.put("/api/admin/professori/:id", authAdmin, async (ctx) => {
  const id = ctx.params.id;
  const body = await ctx.request.body({ type: "json" }).value;
  const existing = await kv.get(["professori", id]);
  if (!existing.value) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Professore non trovato" };
    return;
  }
  const updated = { ...existing.value, ...body, id };
  await kv.set(["professori", id], updated);
  ctx.response.body = updated;
});

// DELETE: elimina un professore
router.delete("/api/admin/professori/:id", authAdmin, async (ctx) => {
  const id = ctx.params.id;
  await kv.delete(["professori", id]);
  ctx.response.body = { success: true };
});

// Endpoint pubblico per ottenere la lista professori (senza auth, per il frontend)
router.get("/api/professori", async (ctx) => {
  const iter = kv.list({ prefix: ["professori"] });
  const professori = [];
  for await (const entry of iter) {
    professori.push(entry.value);
  }
  ctx.response.body = professori;
});

// Impostazioni admin (mock)
router.put("/api/admin/settings", authAdmin, async (ctx) => {
  ctx.response.body = { success: true };
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log("Server avviato su porta", Deno.env.get("PORT") || "8000");
Deno.serve(app.handle.bind(app));
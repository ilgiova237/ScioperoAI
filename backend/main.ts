import { Application, Router } from "oak";
import { adminRouter } from "./routes/admin.ts";
import { analyzeRouter } from "./routes/analyze.ts";
import { historyRouter } from "./routes/history.ts";
import { telegramRouter } from "./routes/telegram.ts";

const app = new Application();
const router = new Router();

// ─────────────────────────────────────────────
// MIDDLEWARE DI DEBUG GLOBALE (deve essere il primo)
// Logga OGNI richiesta e OGNI errore
// ─────────────────────────────────────────────
app.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`[DEBUG] --> ${ctx.request.method} ${ctx.request.url.pathname}`);
  try {
    await next();
    const ms = Date.now() - start;
    console.log(`[DEBUG] <-- ${ctx.request.method} ${ctx.request.url.pathname} ${ctx.response.status} (${ms}ms)`);
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`[ERROR] ${ctx.request.method} ${ctx.request.url.pathname} dopo ${ms}ms:`, err.message || err);
    console.error("[ERROR] Stack:", err.stack || "nessuno stack");
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal Server Error",
      message: err.message || "Errore sconosciuto",
      stack: err.stack || "",
    };
  }
});

// ─────────────────────────────────────────────
// MIDDLEWARE CORS
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// ENDPOINT DI DEBUG: verifica variabili d'ambiente
// ─────────────────────────────────────────────
router.get("/debug/env", (ctx) => {
  ctx.response.body = {
    GEMINI_API_KEY_exists: Deno.env.has("GEMINI_API_KEY"),
    GEMINI_API_KEY_length: Deno.env.get("GEMINI_API_KEY")?.length || 0,
    JWT_SECRET_exists: Deno.env.has("JWT_SECRET"),
    JWT_SECRET_length: Deno.env.get("JWT_SECRET")?.length || 0,
    PORT: Deno.env.get("PORT") || "non impostata",
    DENO_REGION: Deno.env.get("DENO_REGION") || "sconosciuta",
  };
});

// ─────────────────────────────────────────────
// ROTTE API PRINCIPALI (con debug interno)
// ─────────────────────────────────────────────
router.use("/api/admin", adminRouter.routes(), adminRouter.allowedMethods());
router.use("/api/analyze", analyzeRouter.routes(), analyzeRouter.allowedMethods());
router.use("/api/history", historyRouter.routes(), historyRouter.allowedMethods());
router.use("/api/telegram", telegramRouter.routes(), telegramRouter.allowedMethods());

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
router.get("/", (ctx) => {
  ctx.response.body = {
    status: "ok",
    message: "ScioperoScan AI backend attivo",
    timestamp: new Date().toISOString(),
  };
});

app.use(router.routes());
app.use(router.allowedMethods());

// Avvia il server
const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`[INFO] Server avviato sulla porta ${port}`);
Deno.serve(app.handle.bind(app));
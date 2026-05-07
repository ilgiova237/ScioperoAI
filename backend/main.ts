import { Application, Router } from "oak";
import { adminRouter } from "./routes/admin.ts";
import { analyzeRouter } from "./routes/analyze.ts";
import { historyRouter } from "./routes/history.ts";
import { telegramRouter } from "./routes/telegram.ts";

const app = new Application();
const router = new Router();

// Middleware CORS e gestione errori
app.use(async (ctx, next) => {
  try {
    ctx.response.headers.set("Access-Control-Allow-Origin", "*");
    ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (ctx.request.method === "OPTIONS") {
      ctx.response.status = 204;
      return;
    }
    await next();
  } catch (err) {
    console.error("Errore:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error", message: err.message };
  }
});

router.use("/api/admin", adminRouter.routes(), adminRouter.allowedMethods());
router.use("/api/analyze", analyzeRouter.routes(), analyzeRouter.allowedMethods());
router.use("/api/history", historyRouter.routes(), historyRouter.allowedMethods());
router.use("/api/telegram", telegramRouter.routes(), telegramRouter.allowedMethods());

router.get("/", (ctx) => {
  ctx.response.body = { status: "ok", message: "ScioperoScan AI backend attivo" };
});

app.use(router.routes());
app.use(router.allowedMethods());

Deno.serve(app.handle.bind(app));
import { Application, Router, send } from "oak";
import { adminRouter } from "./routes/admin.ts";
import { analyzeRouter } from "./routes/analyze.ts";
import { historyRouter } from "./routes/history.ts";
import { telegramRouter } from "./routes/telegram.ts";
import { pushService } from "./services/push.ts";

const app = new Application();
const router = new Router();

// Middleware CORS
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

// Rotte API
router.use("/api/admin", adminRouter.routes(), adminRouter.allowedMethods());
router.use("/api/analyze", analyzeRouter.routes(), analyzeRouter.allowedMethods());
router.use("/api/history", historyRouter.routes(), historyRouter.allowedMethods());
router.use("/api/telegram", telegramRouter.routes(), telegramRouter.allowedMethods());

// Servire frontend statico (per sviluppo, in produzione useremo GitHub Pages)
router.get("/", async (ctx) => {
  await send(ctx, "./frontend/index.html", { root: Deno.cwd() });
});
router.get("/:path*", async (ctx) => {
  const path = ctx.params.path || "index.html";
  await send(ctx, `./frontend/${path}`, { root: Deno.cwd() });
});

app.use(router.routes());
app.use(router.allowedMethods());

// Avvio bot Telegram (polling infinito) – verrà eseguito solo se la variabile d'ambiente BOT_TOKEN è impostata
if (Deno.env.get("BOT_TOKEN")) {
  import("./routes/telegram.ts").then((mod) => mod.startPolling());
}

console.log("Server avviato su http://localhost:8000");
await app.listen({ port: 8000 });
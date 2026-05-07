import { Application, Router } from "oak";
import { adminRouter } from "./routes/admin.ts";
import { analyzeRouter } from "./routes/analyze.ts";
import { historyRouter } from "./routes/history.ts";
import { telegramRouter } from "./routes/telegram.ts";

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

// Health check
router.get("/", (ctx) => {
  ctx.response.body = { status: "ok" };
});

app.use(router.routes());
app.use(router.allowedMethods());

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`Server in ascolto sulla porta ${port}`);
await app.listen({ port });
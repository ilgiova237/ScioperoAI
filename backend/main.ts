import { Application, Router } from "oak";
import { adminRouter } from "./routes/admin.ts";
import { analyzeRouter } from "./routes/analyze.ts";
import { historyRouter } from "./routes/history.ts";
import { telegramRouter } from "./routes/telegram.ts";

const app = new Application();
const router = new Router();

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
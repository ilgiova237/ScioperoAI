import { Application, Router } from "oak";

const app = new Application();
const router = new Router();

router.get("/", (ctx) => {
  ctx.response.body = { status: "ok" };
});

app.use(router.routes());
app.use(router.allowedMethods());

Deno.serve(app.handle.bind(app));
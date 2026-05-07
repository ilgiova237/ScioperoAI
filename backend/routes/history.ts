import { Router, Context } from "oak";
export const historyRouter = new Router();
historyRouter.get("/", (ctx: Context) => {
  ctx.response.body = []; // Storico non persistente per ora
});
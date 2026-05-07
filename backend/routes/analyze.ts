import { Router, Context } from "oak";
import { callGemini } from "../services/gemini.ts";
import { checkDateAlert } from "../utils/dateAlert.ts";

export const analyzeRouter = new Router();

analyzeRouter.post("/", async (ctx: Context) => {
  const { text } = await ctx.request.body({ type: "json" }).value;
  if (!text || text.length < 50) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Testo troppo corto" };
    return;
  }
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    ctx.response.status = 500;
    ctx.response.body = { error: "API Key Gemini non configurata" };
    return;
  }
  // Per lo storico, puoi saltare KV per ora o usare un semplice array in memoria
  const result = await callGemini(apiKey, text);
  ctx.response.body = { analysis: result, probability: "MEDIA" };
});
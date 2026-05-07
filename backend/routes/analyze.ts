import { Router, Context } from "oak";
import { callGemini } from "../services/gemini.ts";
import { checkDateAlert } from "../utils/dateAlert.ts";
import { pushService } from "../services/push.ts";

const kv = await Deno.openKv();

export const analyzeRouter = new Router();

analyzeRouter.post("/", async (ctx: Context) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const text = body.text;
  if (!text || text.length < 50) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Testo troppo corto" };
    return;
  }

  // Recupera API key e prompt da KV
  const apiKeyRes = await kv.get(["settings", "apiKey"]);
  const promptRes = await kv.get(["settings", "prompt"]);
  const apiKey = apiKeyRes.value as string;
  const promptTemplate = promptRes.value as string || getDefaultPrompt();

  if (!apiKey) {
    ctx.response.status = 400;
    ctx.response.body = { error: "API Key Gemini non configurata" };
    return;
  }

  const finalPrompt = promptTemplate.replace("{DOCUMENT_TEXT}", text);

  try {
    const result = await callGemini(apiKey, finalPrompt);
    // Salva analisi nello storico
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();
    const record = {
      id,
      date: timestamp,
      probability: extractProbability(result),
      text: result,
      originalDocumentSnippet: text.substring(0, 200)
    };
    await kv.set(["history", id], record);

    // Controlla date imminenti e invia notifiche
    const alert = checkDateAlert(text);
    if (alert.days > 0 && alert.days <= 7) {
      // Invia notifiche push a tutte le sottoscrizioni
      await pushService.sendToAll(`Sciopero imminente tra ${alert.days} giorni!`, alert.date);
    }

    ctx.response.body = {
      analysis: result,
      probability: record.probability,
      alert: alert.days > 0 ? { message: `Sciopero imminente tra ${alert.days} giorni`, date: alert.date } : null
    };
  } catch (e) {
    ctx.response.status = 500;
    ctx.response.body = { error: e.message };
  }
});

function extractProbability(text: string): string {
  const upper = text.toUpperCase();
  if (upper.includes("PROBABILITÀ DI SUCCESSO: ALTA")) return "ALTA";
  if (upper.includes("MEDIO-ALTA")) return "MEDIO-ALTA";
  if (upper.includes("MEDIO-BASSA")) return "MEDIO-BASSA";
  if (upper.includes("BASSA")) return "BASSA";
  return "MEDIA";
}
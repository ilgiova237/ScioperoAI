import { Router, Context } from "oak";
import { callGemini } from "../services/gemini.ts";
import { checkDateAlert } from "../utils/dateAlert.ts";

const kv = await Deno.openKv();
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") || "";

export const telegramRouter = new Router();

// Webhook endpoint
telegramRouter.post("/webhook", async (ctx: Context) => {
    const body = await ctx.request.body({ type: "json" }).value;
    if (!body.message) {
        ctx.response.body = { ok: true };
        return;
    }

    const chatId = body.message.chat.id;
    const text = body.message.text || "";
    const document = body.message.document;

    // Gestisce comando /start
    if (text === "/start") {
        await sendTelegramMessage(chatId, "👋 *ScioperoScan AI Bot*\n\nInviami un documento (PDF, DOCX, TXT) o incolla il testo di una circolare sindacale e ti restituirò un'analisi tattica dettagliata.\n\nComandi:\n/start - questo messaggio\n/help - aiuto\n/storico - ultime 3 analisi");
        ctx.response.body = { ok: true };
        return;
    }

    if (text === "/help") {
        await sendTelegramMessage(chatId, "📄 *Come usarmi*\n\n1. Invia un file (PDF, DOCX, DOC, TXT) o incolla direttamente il testo del documento di sciopero.\n2. Attendi l'analisi (può richiedere 30-60 secondi).\n3. Ricevi il report dettagliato.\n\n⚙️ L'API Key Gemini deve essere configurata dal pannello admin.");
        ctx.response.body = { ok: true };
        return;
    }

    if (text === "/storico") {
        const iter = kv.list({ prefix: ["history"] }, { limit: 3 });
        let msg = "*📚 Ultime analisi:*\n\n";
        let count = 0;
        for await (const entry of iter) {
            const record = entry.value as any;
            msg += `• ${record.date?.split("T")[0]} - Prob: ${record.probability}\n`;
            count++;
        }
        if (count === 0) msg += "Nessuna analisi ancora.";
        await sendTelegramMessage(chatId, msg);
        ctx.response.body = { ok: true };
        return;
    }

    let extractedText = text;
    if (document) {
        await sendTelegramMessage(chatId, "📥 Documento ricevuto. Estrazione testo in corso...");
        try {
            const fileId = document.file_id;
            const fileUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`;
            const fileRes = await fetch(fileUrl);
            const fileData = await fileRes.json();
            const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
            const fileBlob = await fetch(downloadUrl);
            extractedText = await fileBlob.text();
            // Per file binari (PDF/DOCX) bisognerebbe usare librerie, ma Telegram Bot API non le ha.
            // Semplifichiamo: supportiamo solo TXT via bot, oppure invitiamo a usare la Web App.
            if (document.mime_type !== "text/plain") {
                await sendTelegramMessage(chatId, "⚠️ Dal bot Telegram supporto solo file TXT. Per PDF e DOCX usa la Web App su https://tuo-dominio.github.io/scioperoscan");
                ctx.response.body = { ok: true };
                return;
            }
        } catch {
            await sendTelegramMessage(chatId, "❌ Errore nel download del file.");
            ctx.response.body = { ok: true };
            return;
        }
    }

    if (extractedText.length < 50) {
        await sendTelegramMessage(chatId, "⚠️ Testo troppo corto per l'analisi. Invia un documento più dettagliato.");
        ctx.response.body = { ok: true };
        return;
    }

    await sendTelegramMessage(chatId, "🔍 Analisi in corso... (può richiedere fino a 60 secondi)");

    const apiKeyRes = await kv.get(["settings", "apiKey"]);
    const promptRes = await kv.get(["settings", "prompt"]);
    const apiKey = apiKeyRes.value as string;
    const promptTemplate = (promptRes.value as string) || "";

    if (!apiKey) {
        await sendTelegramMessage(chatId, "❌ API Key Gemini non configurata. L'amministratore deve impostarla.");
        ctx.response.body = { ok: true };
        return;
    }

    try {
        const finalPrompt = promptTemplate.replace("{DOCUMENT_TEXT}", extractedText);
        const result = await callGemini(apiKey, finalPrompt);

        const timestamp = new Date().toISOString();
        const id = crypto.randomUUID();
        await kv.set(["history", id], {
            id, date: timestamp,
            probability: extractProb(result),
            text: result,
            originalDocumentSnippet: extractedText.substring(0, 200)
        });

        // Invia risultato (Telegram limita a 4096 caratteri, quindi tronchiamo)
        const truncated = result.length > 4000 ? result.substring(0, 4000) + "\n\n... (truncated, usa la Web App per il report completo)" : result;
        await sendTelegramMessage(chatId, `📊 *Analisi completata*\n\n${truncated}`);
    } catch (e) {
        await sendTelegramMessage(chatId, `❌ Errore: ${e.message}`);
    }

    ctx.response.body = { ok: true };
});

// Funzione per inviare messaggi Telegram
async function sendTelegramMessage(chatId: number, text: string) {
    if (!BOT_TOKEN) return;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
}

// Polling attivo (per ambienti senza webhook)
export function startPolling() {
    let offset = 0;
    setInterval(async () => {
        try {
            const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=5`);
            const data = await res.json();
            if (data.result && data.result.length > 0) {
                for (const update of data.result) {
                    offset = update.update_id + 1;
                    // Inoltra l'update al nostro handler
                    await fetch("http://localhost:8000/api/telegram/webhook", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(update)
                    });
                }
            }
        } catch { /* silenzia errori di rete */ }
    }, 3000);
}

function extractProb(text: string): string {
    const u = text.toUpperCase();
    if (u.includes("MEDIO-ALTA")) return "MEDIO-ALTA";
    if (u.includes("ALTA")) return "ALTA";
    if (u.includes("MEDIO-BASSA")) return "MEDIO-BASSA";
    if (u.includes("BASSA")) return "BASSA";
    return "MEDIA";
}
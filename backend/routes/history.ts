import { Router, Context } from "oak";

const kv = await Deno.openKv();

export const historyRouter = new Router();

// Ottieni tutte le analisi
historyRouter.get("/", async (ctx: Context) => {
    const iter = kv.list({ prefix: ["history"] });
    const records = [];
    for await (const entry of iter) {
        records.push(entry.value);
    }
    records.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    ctx.response.body = records;
});

// Ottieni una singola analisi
historyRouter.get("/:id", async (ctx: Context) => {
    const id = ctx.params.id;
    const res = await kv.get(["history", id]);
    if (res.value) {
        ctx.response.body = res.value;
    } else {
        ctx.response.status = 404;
        ctx.response.body = { error: "Analisi non trovata" };
    }
});

// Elimina una analisi
historyRouter.delete("/:id", async (ctx: Context) => {
    const id = ctx.params.id;
    await kv.delete(["history", id]);
    ctx.response.body = { success: true };
});

// Esporta tutto lo storico
historyRouter.get("/export/all", async (ctx: Context) => {
    const iter = kv.list({ prefix: ["history"] });
    const records = [];
    for await (const entry of iter) {
        records.push(entry.value);
    }
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.headers.set("Content-Disposition", "attachment; filename=storico_scioperoscan.json");
    ctx.response.body = JSON.stringify(records, null, 2);
});

// Importa storico
historyRouter.post("/import", async (ctx: Context) => {
    const body = await ctx.request.body({ type: "json" }).value;
    if (!Array.isArray(body)) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Formato non valido: array JSON richiesto" };
        return;
    }
    for (const record of body) {
        if (record.id) {
            await kv.set(["history", record.id], record);
        }
    }
    ctx.response.body = { success: true, imported: body.length };
});
import { Router, Context } from "oak";
import { create, verify } from "jwt";

const kv = await Deno.openKv();

// Hash della password di default (sciopero2024) – generato con crypto.subtle
const DEFAULT_PASSWORD_HASH = "e3f5a8c9b2d4f6a1c3e5b7d9f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0f2a4b6c8e"; // placeholder, useremo hash reale

let passwordHash = DEFAULT_PASSWORD_HASH;

// Carica impostazioni da KV o inizializza
export async function initAdmin() {
  const res = await kv.get(["settings", "passwordHash"]);
  if (res.value) {
    passwordHash = res.value as string;
  } else {
    await kv.set(["settings", "passwordHash"], DEFAULT_PASSWORD_HASH);
  }
  // Carica API key e prompt
  const apiKeyRes = await kv.get(["settings", "apiKey"]);
  if (!apiKeyRes.value) await kv.set(["settings", "apiKey"], "");

  const promptRes = await kv.get(["settings", "prompt"]);
  if (!promptRes.value) await kv.set(["settings", "prompt"], getDefaultPrompt());
}

await initAdmin();

export const adminRouter = new Router();

// Verifica password
adminRouter.post("/verify", async (ctx: Context) => {
  const { password } = await ctx.request.body().value;
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  if (hashHex === passwordHash) {
    const jwt = await create({ alg: "HS256", typ: "JWT" }, { admin: true }, Deno.env.get("JWT_SECRET") || "default-secret");
    ctx.response.body = { token: jwt };
    ctx.response.status = 200;
  } else {
    ctx.response.status = 401;
    ctx.response.body = { error: "Password errata" };
  }
});

// Middleware di autenticazione
export async function authMiddleware(ctx: Context, next: () => Promise<unknown>) {
  const authHeader = ctx.request.headers.get("Authorization");
  if (!authHeader) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Token mancante" };
    return;
  }
  const token = authHeader.replace("Bearer ", "");
  try {
    const payload = await verify(token, Deno.env.get("JWT_SECRET") || "default-secret", "HS256");
    if (!payload.admin) throw new Error("Non admin");
    await next();
  } catch {
    ctx.response.status = 403;
    ctx.response.body = { error: "Token non valido" };
  }
}

// Rotta per cambiare password, API key, prompt (protette)
adminRouter.put("/settings", authMiddleware, async (ctx: Context) => {
  const body = await ctx.request.body().value;
  if (body.password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(body.password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    passwordHash = hashHex;
    await kv.set(["settings", "passwordHash"], hashHex);
  }
  if (body.apiKey !== undefined) {
    await kv.set(["settings", "apiKey"], body.apiKey);
  }
  if (body.prompt !== undefined) {
    await kv.set(["settings", "prompt"], body.prompt);
  }
  ctx.response.body = { success: true };
});

// Rotta per ottenere le impostazioni attuali (senza password)
adminRouter.get("/settings", authMiddleware, async (ctx: Context) => {
  const apiKeyRes = await kv.get(["settings", "apiKey"]);
  const promptRes = await kv.get(["settings", "prompt"]);
  ctx.response.body = {
    apiKey: apiKeyRes.value || "",
    prompt: promptRes.value || getDefaultPrompt(),
    hasPassword: true
  };
});

function getDefaultPrompt(): string {
  return `Sei un analista sindacale esperto del comparto Istruzione italiano...`; // prompt lungo originale
}
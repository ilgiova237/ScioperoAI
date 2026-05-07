import { Router, Context } from "oak";
import { create, verify } from "jwt";

let passwordHash = "e3f5a8c9b2d4f6a1c3e5b7d9f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0f2a4b6c8e"; // placeholder
let apiKey = "";
let prompt = "";

// Inizializzazione da chiamare dopo che il server è partito
export async function initAdmin(kv: Deno.Kv) {
  const res = await kv.get(["settings", "passwordHash"]);
  if (res.value) passwordHash = res.value as string;
  const apiKeyRes = await kv.get(["settings", "apiKey"]);
  if (apiKeyRes.value) apiKey = apiKeyRes.value as string;
  const promptRes = await kv.get(["settings", "prompt"]);
  if (promptRes.value) prompt = promptRes.value as string;
}

export const adminRouter = new Router();

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
  } else {
    ctx.response.status = 401;
    ctx.response.body = { error: "Password errata" };
  }
});

// ... (le altre rotte come prima, ma usando apiKey e prompt globali)
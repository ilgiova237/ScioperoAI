const kv = await Deno.openKv();

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const pushService = {
  async addSubscription(sub: PushSubscription) {
    const id = crypto.randomUUID();
    await kv.set(["pushSubscriptions", id], sub);
  },
  async sendToAll(message: string, date: string) {
    const iter = kv.list({ prefix: ["pushSubscriptions"] });
    const vapidKeys = JSON.parse(Deno.env.get("VAPID_KEYS") || "{}");
    for await (const entry of iter) {
      const sub = entry.value as PushSubscription;
      try {
        await fetch(sub.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Allerta sciopero!",
            body: message,
            data: { url: "/", date }
          }),
          // in produzione bisogna usare le VAPID keys per autenticare l'invio
        });
      } catch {
        // Rimuovi sottoscrizione fallita
        await kv.delete(entry.key);
      }
    }
  }
};
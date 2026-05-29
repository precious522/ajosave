import { createClient } from "redis";
import { serverConfig } from "@/server/config";

let client: ReturnType<typeof createClient> | null = null;

export async function getRedis() {
  if (!client) {
    client = createClient({ url: serverConfig.redis.url });
    client.on("error", (err) => console.error("[Redis]", err));
    await client.connect();
  }
  return client;
}

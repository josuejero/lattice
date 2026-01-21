import { createClient } from "redis";

import { env } from "../env";

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connecting: Promise<RedisClient | null> | null = null;

export async function getRedisClient(): Promise<RedisClient | null> {
  if (!env.REDIS_URL) {
    return null;
  }

  if (client) {
    return client;
  }

  if (connecting) {
    return connecting;
  }

  connecting = (async () => {
    const nextClient = createClient({ url: env.REDIS_URL });
    nextClient.on("error", (error) => {
      console.warn("[redis] connection error", error);
    });

    try {
      await nextClient.connect();
      client = nextClient;
      return client;
    } catch (error) {
      console.warn("[redis] failed to connect", error);
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

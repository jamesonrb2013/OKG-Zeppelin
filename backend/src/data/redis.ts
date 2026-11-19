import { createClient } from "redis";
import { env } from "../env.js";

// Silly type inference issue...
type RedisClient = ReturnType<typeof createClient>;

export const redis: RedisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    // Blitz Redis may be temporarily unavailable while the bot is hosted elsewhere.
    // Keep retrying with bounded backoff instead of making bot startup depend on Redis.
    reconnectStrategy: (retries) => Math.min(1000 * 2 ** Math.min(retries, 5), 30000),
  },
});

let lastErrorLogAt = 0;

redis.on("error", (error) => {
  // Redis can emit an error for every reconnect attempt. Throttle logs so a DNS
  // outage does not flood the Render log stream.
  const now = Date.now();
  if (now - lastErrorLogAt >= 30000) {
    lastErrorLogAt = now;
    console.error("[REDIS] Connection unavailable; reconnecting in the background:", error);
  }
});

redis.on("ready", () => {
  console.log("[REDIS] Connected successfully");
});

redis.on("end", () => {
  console.warn("[REDIS] Connection closed; automatic reconnection will continue");
});

// Do not use top-level await here. A Redis outage must never block importing this
// module or prevent Discord.js and the bot command handlers from starting.
void redis.connect().catch((error) => {
  console.error("[REDIS] Initial connection could not be established; retrying in the background:", error);
});

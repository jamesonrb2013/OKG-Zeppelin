import { createClient } from "redis";
import { env } from "../env.js";

// Silly type inference issue...
type RedisClient = ReturnType<typeof createClient>;

export const redis: RedisClient = createClient({
  url: env.REDIS_URL,
});

redis.on("error", (error) => {
  console.error("[REDIS] Error:", error);
});

let connected = false;

for (let attempt = 1; attempt <= 5; attempt++) {
  try {
    console.log(`[REDIS] Connection attempt ${attempt}/5`);

    await redis.connect();
    connected = true;

    console.log("[REDIS] Connected successfully");
    break;
  } catch (error) {
    console.error(
      `[REDIS] Connection attempt ${attempt}/5 failed:`,
      error,
    );

    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

if (!connected) {
  throw new Error("Unable to connect to Redis after 5 attempts");
}

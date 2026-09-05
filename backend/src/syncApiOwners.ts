import { Client, GatewayIntentBits } from "discord.js";
import { ApiPermissionAssignments } from "./data/ApiPermissionAssignments.js";
import { connect, disconnect } from "./data/db.js";
import { env } from "./env.js";

async function main() {
  await connect();

  const permissions = new ApiPermissionAssignments();
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  try {
    await client.login(env.BOT_TOKEN);

    for (const guild of client.guilds.cache.values()) {
      await permissions.applyOwnerChange(guild.id, guild.ownerId);
      console.log(`Synchronized dashboard owner for guild ${guild.id}`);
    }
  } finally {
    client.destroy();
    disconnect();
  }
}

main().catch((err) => {
  console.error("Failed to synchronize dashboard owners:", err);
  process.exit(1);
});

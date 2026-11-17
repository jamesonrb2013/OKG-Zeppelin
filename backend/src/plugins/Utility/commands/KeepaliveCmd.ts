import { utilityCmd } from "../types.js";

export const KeepaliveCmd = utilityCmd({
  trigger: "keepalive",
  description: "Check that OKG Manager is awake and responding",
  permission: "can_keepalive",

  async run({ message }) {
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    await message.channel.send(
      [
        "🟢 **OKG Manager is awake and responding.**",
        `Uptime: ${hours}h ${minutes}m ${seconds}s`,
      ].join("\n"),
    );
  },
});

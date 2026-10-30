import { Snowflake } from "discord.js";
import { commandTypeHelpers as ct } from "../../../commandTypes.js";
import { isStaffPreFilter } from "../../../pluginUtils.js";
import { noop } from "../../../utils.js";
import { CORE_GUILD_ID } from "../../../env.js";
import { botControlCmd } from "../types.js";

export const DisallowServerCmd = botControlCmd({
  trigger: ["disallow_server", "disallowserver", "remove_server", "removeserver"],
  permission: null,
  config: {
    preFilters: [isStaffPreFilter],
  },

  signature: {
    guildId: ct.string(),
  },

  async run({ pluginData, message: msg, args }) {
    if (args.guildId === CORE_GUILD_ID) {
      void msg.channel.send("The primary One Kid Gaming server is built into the bot and cannot be removed.");
      return;
    }

    const existing = await pluginData.state.allowedGuilds.find(args.guildId);
    if (!existing) {
      void msg.channel.send("That server is not allowed in the first place!");
      return;
    }

    await pluginData.state.allowedGuilds.remove(args.guildId);
    await pluginData.client.guilds.cache
      .get(args.guildId as Snowflake)
      ?.leave()
      .catch(noop);
    void msg.channel.send("Server removed!");
  },
});

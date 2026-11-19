import { guildPluginUserContextMenuCommand } from "vety";
import { launchBanActionModal } from "../actions/ban.js";

export const BanCmd = guildPluginUserContextMenuCommand({
  name: "Ban",
  async run({ pluginData, interaction }) {
    await launchBanActionModal(pluginData, interaction, interaction.targetId);
  },
});

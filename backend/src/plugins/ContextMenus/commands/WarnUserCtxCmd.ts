import { guildPluginUserContextMenuCommand } from "vety";
import { launchWarnActionModal } from "../actions/warn.js";

export const WarnCmd = guildPluginUserContextMenuCommand({
  name: "Warn",
  defaultMemberPermissions: null,
  async run({ pluginData, interaction }) {
    await launchWarnActionModal(pluginData, interaction, interaction.targetId);
  },
});

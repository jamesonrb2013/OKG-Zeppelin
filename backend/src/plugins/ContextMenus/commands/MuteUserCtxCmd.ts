import { guildPluginUserContextMenuCommand } from "vety";
import { launchMuteActionModal } from "../actions/mute.js";

export const MuteCmd = guildPluginUserContextMenuCommand({
  name: "Mute",
  defaultMemberPermissions: null,
  async run({ pluginData, interaction }) {
    await launchMuteActionModal(pluginData, interaction, interaction.targetId);
  },
});

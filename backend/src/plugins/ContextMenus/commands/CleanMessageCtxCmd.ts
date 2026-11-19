import { guildPluginMessageContextMenuCommand } from "vety";
import { launchCleanActionModal } from "../actions/clean.js";

export const CleanCmd = guildPluginMessageContextMenuCommand({
  name: "Clean",
  async run({ pluginData, interaction }) {
    await launchCleanActionModal(pluginData, interaction, interaction.targetId);
  },
});

import { guildPluginUserContextMenuCommand } from "vety";
import { launchNoteActionModal } from "../actions/note.js";

export const NoteCmd = guildPluginUserContextMenuCommand({
  name: "Note",
  async run({ pluginData, interaction }) {
    await launchNoteActionModal(pluginData, interaction, interaction.targetId);
  },
});

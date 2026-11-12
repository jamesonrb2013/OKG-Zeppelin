import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { handleModmailCommand } from "./modmail.js";

export const modmailCommand = new SlashCommandBuilder()
  .setName("modmail")
  .setDescription("Send a support DM or open a Modmail conversation")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("dm")
      .setDescription("Send a branded support DM to a member")
      .addUserOption((option) => option.setName("user").setDescription("Member to message").setRequired(true))
      .addStringOption((option) => option.setName("message").setDescription("Message to send").setRequired(true).setMaxLength(1800)),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("open")
      .setDescription("Open a new Modmail conversation and notify a member")
      .addUserOption((option) => option.setName("user").setDescription("Member to contact").setRequired(true))
      .addStringOption((option) => option.setName("message").setDescription("Opening message for the conversation").setRequired(true).setMaxLength(1000)),
  );

export async function handleModmailSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: import("discord.js").Client,
): Promise<void> {
  await handleModmailCommand(interaction, client);
}

import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";

const MARKER = "okg-updates|role=";

async function getChannel(guild: NonNullable<ChatInputCommandInteraction["guild"]>): Promise<TextChannel | null> {
  const channels = await guild.channels.fetch();
  return (
    channels.find(
      (channel): channel is TextChannel => channel instanceof TextChannel && channel.topic?.startsWith(MARKER) === true,
    ) ?? null
  );
}

export const updatesSetupCommand = new SlashCommandBuilder()
  .setName("updates-setup")
  .setDescription("Create a channel for automatic bot updates")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addRoleOption((option) => option.setName("ping-role").setDescription("Optional role to ping on updates"));

export const updatesConfigCommand = new SlashCommandBuilder()
  .setName("updates-config")
  .setDescription("Set or clear the bot update ping role")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addRoleOption((option) => option.setName("ping-role").setDescription("Role to ping; leave empty to turn pings off"));

export async function handleUpdatesSetup(interaction: ChatInputCommandInteraction) {
  if (
    !interaction.inGuild() ||
    !interaction.guild ||
    !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  ) {
    await interaction.reply({
      content: "This command requires Manage Server permission in a server.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const role = interaction.options.getRole("ping-role");
  const existing = await getChannel(guild);

  if (existing) {
    if (existing.name !== "okg-admin-manage-updates") {
      await existing.setName("okg-admin-manage-updates", "Standardized dedicated bot updates channel name");
    }
    if (role) await existing.setTopic(MARKER + role.id, "Updated bot update ping role");
    await interaction.editReply({
      content: "Your bot update channel is " + existing.toString() + (role ? " and the ping role is configured." : "."),
    });
    return;
  }

  try {
    const channel = await guild.channels.create({
      name: "okg-admin-manage-updates",
      type: ChannelType.GuildText,
      topic: MARKER + (role?.id ?? ""),
      reason: "Bot update channel setup",
    });
    await channel.send({
      content: "Automatic bot updates will be posted here.",
      allowedMentions: { parse: [] },
    });
    await interaction.editReply({
      content:
        "Created " +
        channel.toString() +
        " for bot updates." +
        (role ? " Ping role configured." : " Use /updates-config to set a ping role."),
    });
  } catch (error) {
    console.error("[UPDATES] Channel creation failed:", error);
    await interaction.editReply({
      content: "I couldn't create the channel. Check my Manage Channels and Send Messages permissions.",
    });
  }
}

export async function handleUpdatesConfig(interaction: ChatInputCommandInteraction) {
  if (
    !interaction.inGuild() ||
    !interaction.guild ||
    !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  ) {
    await interaction.reply({
      content: "This command requires Manage Server permission in a server.",
      ephemeral: true,
    });
    return;
  }

  const channel = await getChannel(interaction.guild);
  if (!channel) {
    await interaction.reply({ content: "Run /updates-setup first.", ephemeral: true });
    return;
  }

  const role = interaction.options.getRole("ping-role");
  await channel.setTopic(MARKER + (role?.id ?? ""), "Updated bot update ping role");
  await interaction.reply({
    content: role
      ? "Update ping role saved for " + channel.toString() + "."
      : "Update pings disabled in " + channel.toString() + ".",
    ephemeral: true,
  });
}

export async function postGuildUpdate(
  channel: TextChannel,
  version: string,
  releaseNotes: string,
  fallbackRoleId?: string,
) {
  const topicRoleId = channel.topic?.startsWith(MARKER) ? channel.topic.slice(MARKER.length).trim() : "";
  const candidateRoleId = topicRoleId || fallbackRoleId || "";
  const validRoleId = /^\d{17,20}$/.test(candidateRoleId) ? candidateRoleId : "";
  const timestamp = Math.floor(Date.now() / 1000);
  const notes = releaseNotes.trim().slice(0, 1400);
  const content =
    (validRoleId ? "<@&" + validRoleId + ">\n\n" : "") +
    "## OKG Administrative BotOS — Version " +
    version +
    "\n\n" +
    notes +
    "\n\nUpdated <t:" +
    timestamp +
    ":F>.";

  await channel.send({
    content,
    allowedMentions: { parse: [], users: [], roles: validRoleId ? [validRoleId] : [], repliedUser: false },
  });
}

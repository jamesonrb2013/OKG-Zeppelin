import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";

export const announceCommand = new SlashCommandBuilder()
  .setName("announce")
  .setDescription("Send a polished announcement to a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages.toString())

  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel where the announcement will be sent")
      .setRequired(true),
  )

  .addStringOption((option) =>
    option
      .setName("title")
      .setDescription("Announcement title")
      .setRequired(true)
      .setMaxLength(256),
  )

  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription("Announcement message")
      .setRequired(true)
      .setMaxLength(4000),
  )

  .addStringOption((option) =>
    option
      .setName("color")
      .setDescription("Embed color, for example #5865F2")
      .setMaxLength(7),
  )

  .addStringOption((option) =>
    option
      .setName("mention")
      .setDescription("Optional mention")
      .addChoices(
        { name: "Nobody", value: "none" },
        { name: "@everyone", value: "everyone" },
        { name: "@here", value: "here" },
      ),
  )

  .addStringOption((option) =>
    option
      .setName("image")
      .setDescription("Optional image URL"),
  )

  .addStringOption((option) =>
    option
      .setName("footer")
      .setDescription("Optional footer text")
      .setMaxLength(2048),
  );

export async function handleAnnounceCommand(
  interaction: ChatInputCommandInteraction,
) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return;
  }

  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageMessages,
    )
  ) {
    await interaction.reply({
      content:
        "You need the **Manage Messages** permission to use `/announce`.",
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.options.getChannel("channel", true);

  if (!(channel instanceof TextChannel)) {
    await interaction.reply({
      content: "The selected channel must be a normal text channel.",
      ephemeral: true,
    });
    return;
  }

  const title = interaction.options.getString("title", true);
  const message = interaction.options.getString("message", true);
  const colorInput =
    interaction.options.getString("color") ?? "#5865F2";
  const mention =
    interaction.options.getString("mention") ?? "none";
  const image = interaction.options.getString("image");
  const footer = interaction.options.getString("footer");

  if (!/^#[0-9A-Fa-f]{6}$/.test(colorInput)) {
    await interaction.reply({
      content:
        "Invalid color. Use a 6-digit hex color such as `#5865F2`.",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(colorInput as `#${string}`)
    .setTitle(title)
    .setDescription(message)
    .setTimestamp();

  if (image) {
    try {
      new URL(image);
      embed.setImage(image);
    } catch {
      await interaction.reply({
        content: "The image URL is invalid.",
        ephemeral: true,
      });
      return;
    }
  }

  if (footer) {
    embed.setFooter({
      text: footer,
    });
  }

  const content =
    mention === "everyone"
      ? "@everyone"
      : mention === "here"
        ? "@here"
        : undefined;

  try {
    await channel.send({
      content,
      embeds: [embed],
      allowedMentions: {
        parse: mention === "none" ? [] : ["everyone"],
      },
    });

    await interaction.reply({
      content: `Announcement sent successfully to <#${channel.id}>.`,
      ephemeral: true,
    });
  } catch (error) {
    console.error(
      "[ANNOUNCE] Failed to send announcement:",
      error,
    );

    await interaction.reply({
      content:
        "I could not send the announcement. Check my View Channel, Send Messages, and Embed Links permissions.",
      ephemeral: true,
    });
  }
}

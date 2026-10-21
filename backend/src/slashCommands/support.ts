import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";

type SupportConfig = {
  panel_channel_id?: string | null;
  category_id?: string | null;
  support_role_ids?: string[];
  log_channel_id?: string | null;
  ticket_prefix?: string;
  panel_title?: string;
  panel_description?: string;
  welcome_message?: string;
  max_open_tickets?: number;
};

function getSupportConfig(root: any): SupportConfig | null {
  const plugin = root?.plugins?.support;
  if (!plugin || plugin.enabled === false || typeof plugin !== "object") return null;
  return (plugin.config ?? {}) as SupportConfig;
}

function hasStaffAccess(member: GuildMember, config: SupportConfig): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    (config.support_role_ids ?? []).some((roleId) => member.roles.cache.has(roleId))
  );
}

function ticketMetadata(channel: TextChannel) {
  const topic = channel.topic ?? "";
  const owner = topic.match(/(?:^|\|)owner=(\d+)/)?.[1] ?? null;
  const claimed = topic.match(/(?:^|\|)claimed=([\w-]+)/)?.[1] ?? "none";
  const status = topic.match(/(?:^|\|)status=(open|closed)/)?.[1] ?? "open";
  return { owner, claimed, status };
}

function ticketButtons(status: "open" | "closed") {
  const buttons = new ActionRowBuilder<ButtonBuilder>();
  if (status === "open") {
    buttons.addComponents(
      new ButtonBuilder().setCustomId("okg_support:claim").setLabel("Claim ticket").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("okg_support:unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("okg_support:close").setLabel("Close ticket").setStyle(ButtonStyle.Danger),
    );
  } else {
    buttons.addComponents(
      new ButtonBuilder().setCustomId("okg_support:reopen").setLabel("Reopen ticket").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("okg_support:delete").setLabel("Delete ticket").setStyle(ButtonStyle.Danger),
    );
  }
  return buttons;
}

export const supportPanelCommand = new SlashCommandBuilder()
  .setName("support-panel")
  .setDescription("Post the configured OKG Support ticket panel");

export async function handleSupportPanelCommand(interaction: ChatInputCommandInteraction, rootConfig: unknown) {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: "You need **Manage Server** permission to post the support panel.",
      ephemeral: true,
    });
    return;
  }

  const config = getSupportConfig(rootConfig);
  if (!config) {
    await interaction.reply({
      content: "Support is not enabled. Open OKG Manager → Features → Support, enable it, and save.",
      ephemeral: true,
    });
    return;
  }
  if (!config.panel_channel_id || !config.category_id) {
    await interaction.reply({
      content: "Set both the panel channel and ticket category in OKG Manager → Features → Support first.",
      ephemeral: true,
    });
    return;
  }

  const channel = await interaction.guild.channels.fetch(config.panel_channel_id).catch(() => null);
  if (!(channel instanceof TextChannel)) {
    await interaction.reply({
      content: "The configured panel channel was not found or is not a text channel.",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(config.panel_title || "OKG Support Center")
    .setDescription(config.panel_description || "Open a private support ticket below.")
    .setFooter({ text: "OKG Manager • Support" });

  await channel.send({
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("okg_support:create")
          .setLabel("Open a ticket")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🎫"),
      ),
    ],
    allowedMentions: { parse: [] },
  });
  await interaction.reply({ content: `Support panel posted in <#${channel.id}>.`, ephemeral: true });
}

export async function handleSupportModal(interaction: ModalSubmitInteraction, rootConfig: unknown) {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "Support tickets only work inside a server.", ephemeral: true });
    return;
  }
  const config = getSupportConfig(rootConfig);
  if (!config) {
    await interaction.reply({ content: "Support is currently disabled for this server.", ephemeral: true });
    return;
  }
  if (!config.category_id) {
    await interaction.reply({ content: "Support is missing its ticket category configuration.", ephemeral: true });
    return;
  }

  const guild = interaction.guild;
  const category = await guild.channels.fetch(config.category_id).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) {
    await interaction.reply({
      content: "The configured ticket category could not be found. Ask an administrator to check Support settings.",
      ephemeral: true,
    });
    return;
  }

  const prefix =
    (config.ticket_prefix || "ticket")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 12) || "ticket";
  const openTickets = guild.channels.cache.filter((channel) => {
    if (!(channel instanceof TextChannel) || !channel.topic?.startsWith("okg-support|")) return false;
    const meta = ticketMetadata(channel);
    return meta.owner === interaction.user.id && meta.status === "open";
  });
  const limit = Math.max(1, Math.min(10, config.max_open_tickets ?? 1));
  if (openTickets.size >= limit) {
    await interaction.reply({
      content: `You already have ${openTickets.size} open ticket(s). Please continue in your existing ticket first.`,
      ephemeral: true,
    });
    return;
  }

  const subject = interaction.fields.getTextInputValue("subject").trim();
  const details = interaction.fields.getTextInputValue("details").trim();
  if (subject.length < 3 || details.length < 10) {
    await interaction.reply({
      content: "Please provide a subject and at least 10 characters of details.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const safeName =
    interaction.user.username
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 35) || "user";
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    ...(config.support_role_ids ?? []).map((roleId) => ({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    })),
  ];

  try {
    const ticket = await guild.channels.create({
      name: `${prefix}-${safeName}-${interaction.user.id.slice(-4)}`.slice(0, 95),
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `okg-support|owner=${interaction.user.id}|claimed=none|status=open`,
      permissionOverwrites: overwrites,
      reason: `Support ticket opened by ${interaction.user.tag}`,
    });
    const welcome = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(subject.slice(0, 256))
      .setDescription(details.slice(0, 4000))
      .addFields(
        { name: "Ticket owner", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Claimed by", value: "Not claimed yet", inline: true },
      )
      .setFooter({ text: "OKG Manager Support • Please keep replies in this ticket" })
      .setTimestamp();
    await ticket.send({
      content: `<@${interaction.user.id}> ${(config.support_role_ids ?? []).map((id) => `<@&${id}>`).join(" ")}`.trim(),
      embeds: [welcome],
      components: [ticketButtons("open")],
      allowedMentions: { users: [interaction.user.id], roles: config.support_role_ids ?? [] },
    });
    await interaction.editReply({ content: `Your ticket is ready: <#${ticket.id}>` });
  } catch (error) {
    console.error("[SUPPORT] Could not create ticket from form:", error);
    await interaction.editReply({
      content:
        "I could not create your ticket. Check the bot's Manage Channels, View Channel, and Send Messages permissions, plus the configured support role IDs.",
    });
  }
}

export async function handleSupportInteraction(interaction: ButtonInteraction, rootConfig: unknown) {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "Support tickets only work inside a server.", ephemeral: true });
    return;
  }
  const config = getSupportConfig(rootConfig);
  if (!config) {
    await interaction.reply({ content: "Support is currently disabled for this server.", ephemeral: true });
    return;
  }

  const guild = interaction.guild;
  if (interaction.customId === "okg_support:create") {
    const modal = new ModalBuilder()
      .setCustomId("okg_support:create_modal")
      .setTitle("Open a support ticket")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("subject")
            .setLabel("What do you need help with?")
            .setStyle(TextInputStyle.Short)
            .setMinLength(3)
            .setMaxLength(100)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("details")
            .setLabel("Describe the issue")
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(1800)
            .setPlaceholder("Include what happened and what you have already tried.")
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  if (!(interaction.channel instanceof TextChannel) || !interaction.channel.topic?.startsWith("okg-support|")) {
    await interaction.reply({ content: "This button can only be used inside an OKG support ticket.", ephemeral: true });
    return;
  }

  const channel = interaction.channel;
  const meta = ticketMetadata(channel);
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "I could not verify your server membership.", ephemeral: true });
    return;
  }

  if (interaction.customId === "okg_support:unclaim") {
    if (!hasStaffAccess(member, config)) {
      await interaction.reply({ content: "Only the configured support team can unclaim tickets.", ephemeral: true });
      return;
    }
    if (meta.status !== "open") {
      await interaction.reply({
        content: "This ticket is closed. Reopen it before changing its assignment.",
        ephemeral: true,
      });
      return;
    }
    if (meta.claimed === "none") {
      await interaction.reply({ content: "This ticket is not currently claimed.", ephemeral: true });
      return;
    }
    if (
      meta.claimed !== interaction.user.id &&
      !member.permissions.has(PermissionFlagsBits.ManageChannels) &&
      !member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.reply({
        content: "Only the assigned staff member or a server manager can unclaim this ticket.",
        ephemeral: true,
      });
      return;
    }
    await channel.setTopic(`okg-support|owner=${meta.owner}|claimed=none|status=open`);
    await channel.send({
      content: `↩️ <@${interaction.user.id}> unclaimed this ticket.`,
      allowedMentions: { users: [interaction.user.id] },
    });
    await interaction.reply({ content: "Ticket unclaimed and returned to the support queue.", ephemeral: true });
    return;
  }

  if (interaction.customId === "okg_support:claim") {
    if (!hasStaffAccess(member, config)) {
      await interaction.reply({ content: "Only the configured support team can claim tickets.", ephemeral: true });
      return;
    }
    if (meta.status !== "open") {
      await interaction.reply({ content: "This ticket is closed. Reopen it before claiming.", ephemeral: true });
      return;
    }
    if (meta.claimed !== "none" && meta.claimed !== interaction.user.id) {
      await interaction.reply({ content: `This ticket is already claimed by <@${meta.claimed}>.`, ephemeral: true });
      return;
    }
    await channel.setTopic(`okg-support|owner=${meta.owner}|claimed=${interaction.user.id}|status=open`);
    await channel.send({
      content: `🧑‍💻 <@${interaction.user.id}> claimed this ticket.`,
      allowedMentions: { users: [interaction.user.id] },
    });
    await interaction.reply({ content: "You have claimed this ticket.", ephemeral: true });
    return;
  }

  if (interaction.customId === "okg_support:close") {
    const isOwner = meta.owner === interaction.user.id;
    if (!isOwner && !hasStaffAccess(member, config)) {
      await interaction.reply({
        content: "Only the ticket owner or support team can close this ticket.",
        ephemeral: true,
      });
      return;
    }
    if (meta.status === "closed") {
      await interaction.reply({ content: "This ticket is already closed.", ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    // Fetch history in pages so long tickets are not silently truncated at 100 messages.
    // A hard cap prevents runaway memory use in unusually large channels.
    const transcriptLines: string[] = [];
    let before: string | undefined;
    let fetchedCount = 0;
    while (fetchedCount < 5000) {
      const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch((error) => {
        console.error("[SUPPORT] Transcript history fetch failed:", error);
        return null;
      });
      if (!page || page.size === 0) break;
      const ordered = Array.from(page.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      for (const message of ordered) {
        const body = message.content?.trim() || "";
        const extras = [
          ...Array.from(message.attachments.values()).map((item) => `[attachment] ${item.url}`),
          ...message.embeds.map((embed) => embed.title || embed.description || "[embed]"),
        ];
        transcriptLines.push(
          `[${new Date(message.createdTimestamp).toISOString()}] ${message.author.tag} (${message.author.id})${message.author.bot ? " [BOT]" : ""}: ${body || (extras.length ? "" : "[no text]")}${extras.length ? `\\n  ${extras.join("\\n  ")}` : ""}`,
        );
      }
      fetchedCount += page.size;
      before = page.last()?.id;
      if (page.size < 100 || !before) break;
    }
    const transcript = transcriptLines.join("\\n").slice(0, 7_500_000);
    if (config.log_channel_id) {
      const logChannel = await guild.channels.fetch(config.log_channel_id).catch(() => null);
      if (logChannel instanceof TextChannel) {
        await logChannel
          .send({
            content: `Transcript for **#${channel.name}** • owner ${meta.owner ? `<@${meta.owner}>` : "unknown"} • closed by <@${interaction.user.id}> • ${fetchedCount} messages${fetchedCount >= 5000 ? " (5,000-message safety cap reached)" : ""}`,
            files: [
              new AttachmentBuilder(Buffer.from(transcript || "No messages were available.", "utf8"), {
                name: `transcript-${channel.name}.txt`,
              }),
            ],
            allowedMentions: { parse: [] },
          })
          .catch((error) => console.error("[SUPPORT] Transcript delivery failed:", error));
      } else {
        console.warn("[SUPPORT] Transcript log channel is missing or is not a text channel.");
      }
    }
    await channel.setTopic(`okg-support|owner=${meta.owner}|claimed=${meta.claimed}|status=closed`);
    if (meta.owner) {
      await channel.permissionOverwrites.edit(meta.owner, { SendMessages: false }).catch(() => null);
    }
    await channel.setName(`closed-${channel.name}`.slice(0, 100)).catch(() => null);
    await channel.send({
      content: `🔒 Ticket closed by <@${interaction.user.id}>. Support staff can reopen or delete it below.`,
      components: [ticketButtons("closed")],
      allowedMentions: { users: [interaction.user.id] },
    });
    await interaction.editReply({
      content: "Ticket closed. A transcript was sent to the configured log channel if one is set.",
    });
    return;
  }

  if (interaction.customId === "okg_support:reopen") {
    if (!hasStaffAccess(member, config)) {
      await interaction.reply({ content: "Only the configured support team can reopen tickets.", ephemeral: true });
      return;
    }
    if (meta.status !== "closed" || !meta.owner) {
      await interaction.reply({
        content: "This ticket is not closed or its owner could not be identified.",
        ephemeral: true,
      });
      return;
    }
    await channel.permissionOverwrites
      .edit(meta.owner, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true })
      .catch(() => null);
    await channel.setTopic(`okg-support|owner=${meta.owner}|claimed=${meta.claimed}|status=open`);
    await channel.setName(channel.name.replace(/^closed-/, "").slice(0, 100)).catch(() => null);
    await channel.send({
      content: `🔓 Ticket reopened by <@${interaction.user.id}>.`,
      components: [ticketButtons("open")],
      allowedMentions: { users: [interaction.user.id] },
    });
    await interaction.reply({ content: "Ticket reopened.", ephemeral: true });
    return;
  }

  if (interaction.customId === "okg_support:delete") {
    if (!hasStaffAccess(member, config)) {
      await interaction.reply({ content: "Only the configured support team can delete tickets.", ephemeral: true });
      return;
    }
    await interaction.reply({ content: "Deleting this ticket in 3 seconds.", ephemeral: true });
    setTimeout(() => void channel.delete(`Support ticket deleted by ${interaction.user.tag}`).catch(() => null), 3000);
  }
}

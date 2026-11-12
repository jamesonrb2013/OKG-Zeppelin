import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Message,
  StringSelectMenuBuilder,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { randomUUID } from "node:crypto";
import { Configs } from "../data/Configs.js";
import { loadYamlSafely } from "../utils/loadYamlSafely.js";

const PREFIX = "okg_modmail:";
const COLOR = 0x5865f2;
const SUCCESS = 0x2ecc71;
const WARNING = 0xf1c40f;
const DANGER = 0xed4245;
const configs = new Configs();

export type ModmailConfig = {
  guildId: string;
  inboxChannelId: string;
  roleId: string;
  adminRoleId: string;
  maxOpenConversations: number;
};

function brandEmbed(title: string, description: string, color = COLOR): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: "ONE KID GAMING  •  OKG SUPPORT" })
    .setTitle(title.slice(0, 256))
    .setDescription(description.slice(0, 4000))
    .setFooter({ text: "OKG Manager • Modmail" })
    .setTimestamp();
}

function safeText(value: string, maxLength = 1600): string {
  return value
    .replace(/@everyone/gi, "@ everyone")
    .replace(/@here/gi, "@ here")
    .slice(0, maxLength);
}

function attachmentText(message: Message): string {
  return [...message.attachments.values()]
    .slice(0, 5)
    .map((attachment) => "[" + safeText(attachment.name || "Attachment", 100) + "](" + attachment.url + ")")
    .join("\n");
}

function originalMessageText(message: Message): string {
  const text = safeText(message.content || "", 1200);
  const attachments = attachmentText(message);
  return [text, attachments].filter(Boolean).join("\n\n") || "*(No text or attachments were included.)*";
}

function memberMessageEmbed(userTag: string, text: string, title = "New message from member"): EmbedBuilder {
  return brandEmbed(title, text || "*(No message content.)*")
    .setAuthor({ name: safeText(userTag, 100) })
    .setFooter({ text: "OKG Manager • Member message" });
}

export async function getModmailConfig(guildId: string): Promise<ModmailConfig | null> {
  const row = await configs.getActiveByKey("guild-" + guildId);
  if (!row) return null;
  try {
    const root: any = loadYamlSafely(row.config);
    const plugin = root?.plugins?.support || {};
    const cfg = plugin.config || {};
    if (plugin.enabled === false || cfg.modmail_enabled !== true) return null;

    const inboxChannelId = String(cfg.modmail_inbox_channel_id || "");
    const roleId = String(cfg.modmail_role_id || "");
    const adminRoleId = String(cfg.modmail_admin_role_id || "");
    if (![guildId, inboxChannelId, roleId, adminRoleId].every((id) => /^\d{17,20}$/.test(id))) return null;

    const configuredLimit = Number(cfg.modmail_max_open_conversations);
    const maxOpenConversations = Number.isInteger(configuredLimit)
      ? Math.max(1, Math.min(20, configuredLimit))
      : 5;

    return { guildId, inboxChannelId, roleId, adminRoleId, maxOpenConversations };
  } catch (error) {
    console.warn("[MODMAIL] Could not read server configuration:", error);
    return null;
  }
}

export async function getConfiguredModmailServers(): Promise<ModmailConfig[]> {
  const rows = await configs.getActive();
  const result: ModmailConfig[] = [];
  for (const row of rows) {
    if (!row.key.startsWith("guild-")) continue;
    const cfg = await getModmailConfig(row.key.slice(6));
    if (cfg) result.push(cfg);
  }
  return result;
}

async function getInbox(client: Client, cfg: ModmailConfig): Promise<TextChannel> {
  const channel = await client.channels.fetch(cfg.inboxChannelId);
  if (!(channel instanceof TextChannel)) {
    throw new Error("The configured Modmail inbox is unavailable or is not a text channel.");
  }
  return channel;
}

export async function getMemberConversations(inbox: TextChannel, userId: string): Promise<ThreadChannel[]> {
  const prefix = "modmail-" + userId + "-";
  const active = await inbox.threads.fetchActive();
  const results = new Map<string, ThreadChannel>();
  for (const thread of active.threads.values()) {
    if (thread.name.startsWith(prefix)) results.set(thread.id, thread as ThreadChannel);
  }

  const archived = await inbox.threads.fetchArchived({ type: "public", limit: 100 }).catch(() => null);
  for (const thread of archived?.threads.values() ?? []) {
    if (thread.name.startsWith(prefix)) results.set(thread.id, thread as ThreadChannel);
  }

  return [...results.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
}

function conversationLabel(thread: ThreadChannel, index: number): string {
  const shortId = thread.name.split("-").pop()?.slice(0, 6) || String(index + 1);
  const created = Math.floor(thread.createdTimestamp / 1000);
  return ("Conversation " + shortId + " • <t:" + created + ":d>").slice(0, 100);
}

function serverChoiceMenu(userId: string, choices: Array<{ cfg: ModmailConfig; name: string }>) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(PREFIX + "server:" + userId)
    .setPlaceholder("Choose the server you need help with")
    .addOptions(
      choices.slice(0, 25).map(({ cfg, name }) => ({
        label: name.slice(0, 100),
        value: cfg.guildId,
        description: "Contact this server's support team",
      })),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function conversationMenu(userId: string, guildId: string, threads: ThreadChannel[], canStartNew: boolean) {
  const options = threads.filter((thread) => !thread.archived).slice(0, canStartNew ? 24 : 25).map((thread, index) => ({
    label: conversationLabel(thread, index),
    value: "thread:" + thread.id,
    description: "Continue this support conversation",
  }));
  if (canStartNew) {
    options.push({
      label: "＋ Start a new conversation",
      value: "new",
      description: "Open a separate support conversation",
    });
  }
  const menu = new StringSelectMenuBuilder()
    .setCustomId(PREFIX + "conversation:" + userId + ":" + guildId)
    .setPlaceholder("Choose a conversation or start a new one")
    .addOptions(options);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function consentButtons(guildId: string, userId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PREFIX + "consent:" + guildId + ":" + userId)
      .setLabel("Send to support")
      .setEmoji("📨")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(PREFIX + "decline:" + userId)
      .setLabel("Keep private")
      .setStyle(ButtonStyle.Secondary),
  );
}

function closeButton(guildId: string, userId: string, threadId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PREFIX + "close:" + guildId + ":" + userId + ":" + threadId)
      .setLabel("Close conversation")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
  );
}

async function sendServerChoice(message: Message, choices: Array<{ cfg: ModmailConfig; name: string }>): Promise<void> {
  await message.reply({
    embeds: [
      brandEmbed(
        "Where do you need help?",
        "Choose the OKG server you want to contact. Your message will only be shared with the support team you select.\n\n" +
          "**Your message**\n" + originalMessageText(message),
      ),
    ],
    components: [serverChoiceMenu(message.author.id, choices)],
    allowedMentions: { parse: [] },
  });
}

async function sendConversationPicker(
  interaction: any,
  cfg: ModmailConfig,
  userId: string,
  firstMessage: string,
  inbox: TextChannel,
): Promise<void> {
  const threads = await getMemberConversations(inbox, userId);
  const openThreads = threads.filter((thread) => !thread.archived);
  const canStartNew = openThreads.length < cfg.maxOpenConversations;
  const description = [
    "Select an open conversation to continue, or start a separate one.",
    "**Open conversations:** " + openThreads.length + " / " + cfg.maxOpenConversations,
    "",
    "**Your message**",
    firstMessage || "*(No message content.)*",
  ].join("\n");

  await interaction.editReply({
    embeds: [brandEmbed("Choose a conversation", description)],
    components: [conversationMenu(userId, cfg.guildId, openThreads, canStartNew)],
  });
}

async function openConversation(
  client: Client,
  userId: string,
  guildId: string,
  firstMessage: string,
  openedBy: string,
): Promise<ThreadChannel> {
  const cfg = await getModmailConfig(guildId);
  if (!cfg) throw new Error("Modmail is not configured for this server.");

  const inbox = await getInbox(client, cfg);
  const openThreads = (await getMemberConversations(inbox, userId)).filter((thread) => !thread.archived);
  if (openThreads.length >= cfg.maxOpenConversations) {
    throw new Error("This member has reached the server's open-conversation limit (" + cfg.maxOpenConversations + ").");
  }

  const user = await client.users.fetch(userId);
  const shortId = randomUUID().replace(/-/g, "").slice(0, 8);
  const starter = await inbox.send({
    content: "<@&" + cfg.roleId + "> <@&" + cfg.adminRoleId + ">",
    embeds: [
      brandEmbed("✉️  New Modmail conversation", "A new support conversation has been opened.")
        .addFields(
          { name: "MEMBER", value: user.tag + "\n<@" + user.id + ">\n`" + user.id + "`", inline: true },
          { name: "STATUS", value: "🟢 Open", inline: true },
          { name: "OPENED BY", value: safeText(openedBy, 100), inline: true },
          { name: "FIRST MESSAGE", value: safeText(firstMessage || "*(No message content.)*", 1000), inline: false },
        )
        .setThumbnail(user.displayAvatarURL()),
    ],
    allowedMentions: { parse: [], roles: [cfg.roleId, cfg.adminRoleId], users: [] },
  });

  const thread = await starter.startThread({
    name: "modmail-" + userId + "-" + shortId,
    autoArchiveDuration: 10080,
    reason: "OKG Modmail conversation opened",
  });

  await thread.send({
    embeds: [
      brandEmbed("Conversation controls", "Staff replies in this thread are delivered directly to the member by DM.\n\nUse the button below to close this conversation. Only Modmail administrators can close it.")
        .addFields(
          { name: "MEMBER", value: user.tag + " • `" + user.id + "`", inline: true },
          { name: "STATUS", value: "🟢 Open", inline: true },
        ),
    ],
    components: [closeButton(guildId, userId, thread.id)],
  });

  await thread.send({ embeds: [memberMessageEmbed(openedBy, firstMessage, "Conversation started")] });
  return thread;
}

export async function createStaffConversation(
  client: Client,
  guildId: string,
  userId: string,
  message: string,
  staffTag: string,
): Promise<ThreadChannel> {
  const thread = await openConversation(client, userId, guildId, message, staffTag);
  const user = await client.users.fetch(userId);
  await user.send({
    embeds: [
      brandEmbed("A support conversation has been opened", "A member of the **" + safeText(thread.guild.name, 100) + "** support team has opened a conversation with you.\n\n**Message from staff**\n" + safeText(message))
        .setColor(SUCCESS),
    ],
    allowedMentions: { parse: [] },
  });
  return thread;
}

export async function sendStaffDirectMessage(
  client: Client,
  guildId: string,
  userId: string,
  message: string,
  staffTag: string,
): Promise<void> {
  const cfg = await getModmailConfig(guildId);
  if (!cfg) throw new Error("Modmail is not enabled for this server.");
  const user = await client.users.fetch(userId);
  await user.send({
    embeds: [
      brandEmbed("A message from OKG Support", "**" + safeText(staffTag, 100) + "**\n\n" + safeText(message))
        .setColor(COLOR),
    ],
    allowedMentions: { parse: [] },
  });
}

export async function handleModmailMessage(client: Client, incoming: Message): Promise<void> {
  if (incoming.partial) {
    const fetched = await incoming.fetch().catch(() => null);
    if (!fetched) return;
    incoming = fetched;
  }
  const message = incoming;
  if (message.author.bot || message.webhookId) return;

  if (!message.guildId) {
    const all = await getConfiguredModmailServers();
    if (!all.length) {
      await message.reply({
        embeds: [brandEmbed("Support is unavailable", "OKG Modmail is not enabled in any server yet. Please contact a server administrator.")],
      }).catch(() => undefined);
      return;
    }

    const choices: Array<{ cfg: ModmailConfig; name: string }> = [];
    for (const cfg of all) {
      const guild = client.guilds.cache.get(cfg.guildId) || await client.guilds.fetch(cfg.guildId).catch(() => null);
      if (!guild) continue;
      const member = await guild.members.fetch(message.author.id).catch(() => null);
      if (member) choices.push({ cfg, name: guild.name });
    }
    if (!choices.length) {
      await message.reply({
        embeds: [brandEmbed("No eligible server found", "You need to be a member of a server that has OKG Modmail enabled.")],
      }).catch(() => undefined);
      return;
    }
    await sendServerChoice(message, choices);
    return;
  }

  if (!message.channel.isThread()) return;
  const thread = message.channel as ThreadChannel;
  if (!thread.name.startsWith("modmail-")) return;
  const match = thread.name.match(/^modmail-(\d{17,20})-[a-z0-9]+$/i);
  if (!match) return;
  const userId = match[1];
  const cfg = await getModmailConfig(message.guildId);
  if (!cfg) return;
  const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
  if (!member || (!member.roles.cache.has(cfg.roleId) && !member.roles.cache.has(cfg.adminRoleId))) return;

  if (message.content.trim().toLowerCase() === "!close") {
    if (!member.roles.cache.has(cfg.adminRoleId)) {
      await message.reply({ embeds: [brandEmbed("Permission required", "Only Modmail administrators can close conversations.", DANGER)] });
      return;
    }
    await thread.send({ embeds: [brandEmbed("🔒 Conversation closed", "Closed by **" + safeText(message.author.tag, 100) + "**.", DANGER)] });
    const user = await client.users.fetch(userId).catch(() => null);
    await user?.send({ embeds: [brandEmbed("Your support conversation is closed", "This conversation has been closed by the support team. You can DM OKG Manager again if you need further help.", DANGER)] }).catch(() => undefined);
    await thread.setArchived(true, "Closed by Modmail staff");
    return;
  }

  const body = originalMessageText(message);
  if (body === "*(No text or attachments were included.)*") return;
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) {
    await thread.send({ embeds: [brandEmbed("Delivery failed", "The member could not be reached.", DANGER)] });
    return;
  }

  try {
    await user.send({
      embeds: [
        brandEmbed("Reply from OKG Support", "**" + safeText(message.author.tag, 100) + "**\n\n" + safeText(body))
          .setColor(COLOR),
      ],
      allowedMentions: { parse: [] },
    });
    await message.react("📨").catch(() => undefined);
  } catch {
    await thread.send({ embeds: [brandEmbed("DM delivery failed", "The member may have direct messages disabled. The reply was not delivered.", DANGER)] });
  }
}

export async function handleModmailInteraction(client: Client, interaction: any): Promise<boolean> {
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith(PREFIX + "server:")) {
    const userId = interaction.customId.slice((PREFIX + "server:").length);
    if (interaction.user.id !== userId) {
      await interaction.reply({ embeds: [brandEmbed("Not your menu", "This server selection belongs to another member.", DANGER)], ephemeral: true });
      return true;
    }
    await interaction.deferUpdate();
    const guildId = interaction.values[0];
    const cfg = await getModmailConfig(guildId);
    const guild = cfg ? (client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null)) : null;
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!cfg || !member) {
      await interaction.editReply({ embeds: [brandEmbed("Server unavailable", "That support destination is no longer available. Please DM OKG Manager again.", DANGER)], components: [] });
      return true;
    }
    const inbox = await getInbox(client, cfg).catch(() => null);
    if (!inbox) {
      await interaction.editReply({ embeds: [brandEmbed("Inbox unavailable", "This server's support inbox is unavailable right now. Please try again later.", DANGER)], components: [] });
      return true;
    }
    const serverDescription = String(interaction.message?.embeds?.[0]?.description || "");
    const firstMessage = serverDescription.split("**Your message**\\n").slice(1).join("**Your message**\\n") || "*(No message content.)*";
    await sendConversationPicker(interaction, cfg, userId, firstMessage, inbox);
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith(PREFIX + "conversation:")) {
    const parts = interaction.customId.slice((PREFIX + "conversation:").length).split(":");
    const userId = parts[0];
    const guildId = parts[1];
    if (interaction.user.id !== userId) {
      await interaction.reply({ embeds: [brandEmbed("Not your menu", "This conversation selector belongs to another member.", DANGER)], ephemeral: true });
      return true;
    }
    await interaction.deferUpdate();
    const cfg = await getModmailConfig(guildId);
    const inbox = cfg ? await getInbox(client, cfg).catch(() => null) : null;
    const guild = cfg ? (client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null)) : null;
    const guildMember = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!cfg || !inbox || !guildMember) {
      await interaction.editReply({ embeds: [brandEmbed("Support unavailable", "That support destination is no longer available.", DANGER)], components: [] });
      return true;
    }
    const selected = interaction.values[0];
    const firstMessage = String(interaction.message?.embeds?.[0]?.description || "").split("**Your message**\n").slice(1).join("**Your message**\n");
    if (selected === "new") {
      const open = (await getMemberConversations(inbox, userId)).filter((thread) => !thread.archived);
      if (open.length >= cfg.maxOpenConversations) {
        await interaction.editReply({ embeds: [brandEmbed("Conversation limit reached", "You already have " + open.length + " open conversations, which is the maximum allowed by this server.", WARNING)], components: [] });
        return true;
      }
      await interaction.editReply({
        embeds: [brandEmbed("Confirm your new conversation", "Your message will be shared with this server's Modmail staff.\n\n**Your message**\n" + safeText(firstMessage))],
        components: [consentButtons(guildId, userId)],
      });
      return true;
    }

    const threadId = selected.replace(/^thread:/, "");
    const thread = (await getMemberConversations(inbox, userId)).find((item) => item.id === threadId && !item.archived);
    if (!thread) {
      await interaction.editReply({ embeds: [brandEmbed("Conversation unavailable", "That conversation has been closed or is no longer available. Please DM OKG Manager again.", WARNING)], components: [] });
      return true;
    }
    await thread.send({ embeds: [memberMessageEmbed(interaction.user.tag, firstMessage, "New message from member")] });
    await interaction.editReply({ embeds: [brandEmbed("Message delivered", "Your message has been added to the selected conversation. Staff will reply to you here by DM.", SUCCESS)], components: [] });
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith(PREFIX + "decline:")) {
    const userId = interaction.customId.slice((PREFIX + "decline:").length);
    if (interaction.user.id !== userId) {
      await interaction.reply({ embeds: [brandEmbed("Not your confirmation", "This confirmation belongs to another member.", DANGER)], ephemeral: true });
      return true;
    }
    await interaction.update({ embeds: [brandEmbed("Message kept private", "No problem. Your message was not sent to support staff.", SUCCESS)], components: [] });
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith(PREFIX + "consent:")) {
    const parts = interaction.customId.slice((PREFIX + "consent:").length).split(":");
    const guildId = parts[0];
    const userId = parts[1];
    if (interaction.user.id !== userId) {
      await interaction.reply({ embeds: [brandEmbed("Not your confirmation", "This confirmation belongs to another member.", DANGER)], ephemeral: true });
      return true;
    }
    await interaction.deferUpdate();
    try {
      const quoted = String(interaction.message?.embeds?.[0]?.description || "");
      const firstMessage = quoted.split("**Your message**\n").slice(1).join("**Your message**\n") || "*(No message content.)*";
      const thread = await openConversation(client, userId, guildId, firstMessage, "Member request");
      await interaction.editReply({ embeds: [brandEmbed("Conversation opened", "Your message has been sent to OKG support. You can keep replying to the bot and choose this conversation whenever you need.", SUCCESS)], components: [] });
      const user = await client.users.fetch(userId).catch(() => null);
      await user?.send({ embeds: [brandEmbed("Your OKG support conversation is open", "Conversation **" + thread.name.split("-").pop() + "** has been created. Reply to this DM whenever you need help; you can choose which conversation your message belongs to.", SUCCESS)] }).catch(() => undefined);
    } catch (error) {
      console.error("[MODMAIL] Could not open conversation:", error);
      await interaction.editReply({ embeds: [brandEmbed("Could not open conversation", error instanceof Error ? error.message : "Please try again later.", DANGER)], components: [] });
    }
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith(PREFIX + "close:")) {
    const parts = interaction.customId.slice((PREFIX + "close:").length).split(":");
    const [guildId, userId, threadId] = parts;
    await interaction.deferReply({ ephemeral: true });
    const cfg = await getModmailConfig(guildId);
    const guild = interaction.guild;
    const member = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;
    if (!cfg || !member?.roles.cache.has(cfg.adminRoleId)) {
      await interaction.editReply({ embeds: [brandEmbed("Permission denied", "Only the configured Modmail admin role can close conversations.", DANGER)] });
      return true;
    }
    const channel = await client.channels.fetch(threadId).catch(() => null);
    if (!(channel instanceof ThreadChannel) || channel.guildId !== guildId || !channel.name.startsWith("modmail-" + userId + "-")) {
      await interaction.editReply({ embeds: [brandEmbed("Conversation unavailable", "This conversation could not be found.", DANGER)] });
      return true;
    }
    await channel.send({ embeds: [brandEmbed("🔒 Conversation closed", "Closed by **" + safeText(interaction.user.tag, 100) + "**.", DANGER)] });
    await channel.setArchived(true, "Closed by Modmail admin");
    const user = await client.users.fetch(userId).catch(() => null);
    await user?.send({ embeds: [brandEmbed("Your support conversation is closed", "This conversation has been closed by the support team. You can DM OKG Manager again to start or continue another conversation.", DANGER)] }).catch(() => undefined);
    await interaction.editReply({ embeds: [brandEmbed("Conversation closed", "The conversation has been closed and archived.", SUCCESS)] });
    return true;
  }

  return false;
}

export async function handleModmailCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({ embeds: [brandEmbed("Server only", "Use this command inside a server.", DANGER)], ephemeral: true });
    return;
  }
  const cfg = await getModmailConfig(interaction.guildId);
  const member = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);
  if (!cfg || !member || (!member.roles.cache.has(cfg.roleId) && !member.roles.cache.has(cfg.adminRoleId))) {
    await interaction.reply({ embeds: [brandEmbed("Permission denied", "You need the configured Modmail staff or admin role to use this command.", DANGER)], ephemeral: true });
    return;
  }

  const action = interaction.options.getSubcommand();
  const user = interaction.options.getUser("user", true);
  const message = interaction.options.getString("message", true);
  const targetMember = await interaction.guild!.members.fetch(user.id).catch(() => null);
  if (!targetMember) {
    await interaction.reply({ embeds: [brandEmbed("Member not found", "Choose a member of this server.", DANGER)], ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  try {
    if (action === "dm") {
      await sendStaffDirectMessage(client, interaction.guildId, user.id, message, interaction.user.tag);
      await interaction.editReply({ embeds: [brandEmbed("DM delivered", "Your branded support message was delivered to **" + safeText(user.tag, 100) + "**.", SUCCESS)] });
      return;
    }
    const thread = await createStaffConversation(client, interaction.guildId, user.id, message, interaction.user.tag);
    await interaction.editReply({ embeds: [brandEmbed("Conversation opened", "Opened a new conversation with **" + safeText(user.tag, 100) + "**.\n\nStaff thread: <#" + thread.id + ">.", SUCCESS)] });
  } catch (error) {
    await interaction.editReply({ embeds: [brandEmbed("Modmail action failed", error instanceof Error ? error.message : "The action could not be completed.", DANGER)] });
  }
}

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Message,
  StringSelectMenuBuilder,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { Configs } from "../data/Configs.js";
import { loadYamlSafely } from "../utils/loadYamlSafely.js";

const CONSENT = "okg_modmail:consent:";
const MESSAGE_START = "\n\n**Your message:**\n";
const MESSAGE_END = "\n\n— End of original message —";
const configs = new Configs();

type ModmailConfig = {
  guildId: string;
  inboxChannelId: string;
  roleId: string;
  adminRoleId: string;
};

async function configured(): Promise<ModmailConfig[]> {
  const rows = await configs.getActive();
  const found: ModmailConfig[] = [];

  for (const row of rows) {
    if (!row.key.startsWith("guild-")) continue;

    try {
      const root: any = loadYamlSafely(row.config);
      const supportPlugin = root?.plugins?.support || {};
      const cfg = supportPlugin.config || {};
      if (supportPlugin.enabled === false || cfg.modmail_enabled !== true) continue;

      const guildId = row.key.slice(6);
      const inboxChannelId = String(cfg.modmail_inbox_channel_id || "");
      const roleId = String(cfg.modmail_role_id || "");
      const adminRoleId = String(cfg.modmail_admin_role_id || "");

      if (
        !/^\d{17,20}$/.test(guildId) ||
        !/^\d{17,20}$/.test(inboxChannelId) ||
        !/^\d{17,20}$/.test(roleId) ||
        !/^\d{17,20}$/.test(adminRoleId)
      ) {
        console.warn("[MODMAIL] Skipping invalid Modmail configuration for guild", guildId);
        continue;
      }

      found.push({ guildId, inboxChannelId, roleId, adminRoleId });
    } catch (error) {
      console.warn("[MODMAIL] Could not read guild config:", error);
    }
  }

  return found;
}

function safeText(value: string, maxLength = 1700): string {
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
  return [text, attachments].filter(Boolean).join("\n\n") || "[Message without text or attachments]";
}

async function findThread(channel: TextChannel, userId: string): Promise<ThreadChannel | null> {
  const name = "modmail-" + userId;
  const active = await channel.threads.fetchActive();
  const activeThread = active.threads.find((item) => item.name === name);
  if (activeThread) return activeThread as ThreadChannel;

  const archived = await channel.threads.fetchArchived({ type: "public", limit: 100 }).catch(() => null);
  const archivedThread = archived?.threads.find((item) => item.name === name) ?? null;
  if (!archivedThread) return null;

  if (archivedThread.archived) {
    await archivedThread.setArchived(false);
  }

  return archivedThread as ThreadChannel;
}

function consentButtons(guildId: string, userId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CONSENT + guildId + ":" + userId)
      .setLabel("Yes, contact support")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CONSENT + "no:" + userId)
      .setLabel("No")
      .setStyle(ButtonStyle.Secondary),
  );
}

function consentPrompt(messageText: string): string {
  return (
    "**Would you like to send this message to support staff?**" +
    MESSAGE_START +
    messageText +
    MESSAGE_END +
    "\n\nChoose **Yes** to send it to the support team, or **No** to keep it private."
  ).slice(0, 2000);
}

async function sendServerChoice(message: Message, choices: Array<{ cfg: ModmailConfig; name: string }>): Promise<void> {
  if (choices.length > 25) {
    console.warn("[MODMAIL] More than 25 eligible servers found; Discord select menus support at most 25 options.");
  }
  const menu = new StringSelectMenuBuilder()
    .setCustomId("okg_modmail:server:" + message.author.id)
    .setPlaceholder("Choose which server should receive your message")
    .addOptions(
      choices.slice(0, 25).map(({ cfg, name }) => ({
        label: name.slice(0, 100),
        value: cfg.guildId,
        description: "Send this message to this server's support team",
      })),
    );

  await message.reply({
    content:
      "**Which server would you like to contact?**" +
      MESSAGE_START +
      originalMessageText(message) +
      MESSAGE_END,
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
    allowedMentions: { parse: [] },
  });
}

async function openConversation(
  client: Client,
  userId: string,
  guildId: string,
  firstMessage: string,
): Promise<void> {
  const cfg = (await configured()).find((item) => item.guildId === guildId);
  if (!cfg) throw new Error("Modmail is not configured for this server.");

  const inbox = await client.channels.fetch(cfg.inboxChannelId);
  if (!(inbox instanceof TextChannel)) {
    throw new Error("The configured Modmail inbox is unavailable or is not a text channel.");
  }

  const existing = await findThread(inbox, userId);
  if (existing) {
    await existing.send({
      content: "**New message from member:**\n" + safeText(firstMessage || "[No message text]"),
      allowedMentions: { parse: [] },
    });
    return;
  }

  const user = await client.users.fetch(userId);
  const starter = await inbox.send({
    content:
      "<@&" +
      cfg.roleId +
      "> <@&" +
      cfg.adminRoleId +
      "> **New Modmail conversation**\n" +
      "**Member:** " +
      safeText(user.tag, 100) +
      " (\x60" +
      user.id +
      "\x60)\n" +
      "**Reply by writing in this thread.**",
    allowedMentions: { parse: [], roles: [cfg.roleId, cfg.adminRoleId], users: [] },
  });

  const thread = await starter.startThread({
    name: "modmail-" + userId,
    autoArchiveDuration: 10080,
    reason: "OKG Modmail conversation",
  });

  await thread.send({
    content:
      "**Original message from member:**\n" +
      safeText(firstMessage || "[No message text]") +
      "\n\nStaff replies in this thread are delivered to the member by DM.",
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
    console.info("[MODMAIL] Received member DM", message.author.id);
    const all = await configured();
    if (!all.length) {
      await message.reply(
        "OKG Modmail is not enabled in any server yet. Please contact a server administrator or use the server's support channel.",
      ).catch((error) => console.error("[MODMAIL] Could not send the not-configured reply:", error));
      return;
    }

    // A DM is global to the bot, so route it only to a server the member actually belongs to.
    const choices: Array<{ cfg: ModmailConfig; name: string }> = [];
    for (const cfg of all) {
      const guild = client.guilds.cache.get(cfg.guildId) || await client.guilds.fetch(cfg.guildId).catch(() => null);
      if (!guild) continue;
      const member = await guild.members.fetch(message.author.id).catch(() => null);
      if (member) choices.push({ cfg, name: guild.name });
    }
    if (!choices.length) {
      await message.reply("OKG Support is not enabled in a server you share with this bot.").catch(() => undefined);
      return;
    }
    // Always ask the member to choose the destination, even when only one server
    // is currently eligible. This keeps the DM workflow explicit and consistent.
    await sendServerChoice(message, choices);
    return;

  }

  if (!message.channel.isThread()) return;

  const thread = message.channel as ThreadChannel;
  if (!thread.name.startsWith("modmail-")) return;

  const userId = thread.name.slice("modmail-".length);
  if (!/^\d{17,20}$/.test(userId)) return;

  const cfg = (await configured()).find((item) => item.guildId === message.guildId);
  if (!cfg) return;

  const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
  if (!member) return;
  const isStaff = member.roles.cache.has(cfg.roleId);
  const isAdmin = member.roles.cache.has(cfg.adminRoleId);
  if (!isStaff && !isAdmin) return;

  if (message.content.trim().toLowerCase() === "!close") {
    if (!isAdmin) {
      await message.reply("Only the configured Modmail admin role can close conversations.");
      return;
    }
    await thread.send("🔒 Conversation closed by " + safeText(message.author.tag, 100) + ".");
    const user = await client.users.fetch(userId).catch(() => null);
    await user
      ?.send("Your OKG support conversation has been closed. You can DM OKG Manager again if you need further help.")
      .catch(() => undefined);
    await thread.setArchived(true, "Closed by Modmail staff");
    return;
  }

  const body = originalMessageText(message);
  if (body === "[Message without text or attachments]") return;

  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) {
    await thread.send("Could not deliver this reply: the member is unavailable.");
    return;
  }

  try {
    await user.send({
      content: "**OKG Support — " + safeText(message.author.tag, 100) + "**\n" + safeText(body),
      allowedMentions: { parse: [] },
    });
    await message.react("📨").catch(() => undefined);
  } catch {
    await thread.send("Delivery failed. The member may have DMs disabled.");
  }
}

export async function handleModmailInteraction(client: Client, interaction: any): Promise<boolean> {
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("okg_modmail:server:")) {
    const userId = interaction.customId.slice("okg_modmail:server:".length);
    if (interaction.user.id !== userId) {
      await interaction.reply({ content: "This server selection belongs to another member.", ephemeral: true });
      return true;
    }

    // A Discord interaction must be acknowledged within three seconds. Guild
    // and member fetches can take longer, so acknowledge before doing any I/O.
    await interaction.deferUpdate();
    const guildId = interaction.values[0];
    const cfg = (await configured()).find((item) => item.guildId === guildId);
    const guild = cfg ? (client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null)) : null;
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!cfg || !member) {
      await interaction.editReply({ content: "That support destination is no longer available. Please DM OKG Manager again.", components: [] });
      return true;
    }
    const quoted = String(interaction.message?.content || "");
    const start = quoted.indexOf(MESSAGE_START);
    const end = quoted.indexOf(MESSAGE_END, start + MESSAGE_START.length);
    const firstMessage = start >= 0
      ? quoted.slice(start + MESSAGE_START.length, end >= 0 ? end : undefined).trim()
      : "[Original message unavailable]";

    // Existing conversations should receive follow-ups immediately after the
    // member selects the destination; consent is required only to open a new
    // support conversation.
    const inbox = await client.channels.fetch(cfg.inboxChannelId).catch(() => null);
    if (!(inbox instanceof TextChannel)) {
      await interaction.editReply({
        content: "That server's support inbox is unavailable right now. Please try again later.",
        components: [],
      });
      return true;
    }
    const existingThread = await findThread(inbox, userId).catch((error) => {
      console.error("[MODMAIL] Could not find the member's existing thread:", error);
      return null;
    });
    if (existingThread) {
      await existingThread.send({
        content: "**" + safeText(interaction.user.tag, 100) + ":**\\n" + safeText(firstMessage),
        allowedMentions: { parse: [] },
      });
      await interaction.editReply({
        content: "Your message has been delivered to your existing support conversation. Staff will reply here by DM.",
        components: [],
      });
      return true;
    }

    await interaction.editReply({
      content: consentPrompt(firstMessage),
      components: [consentButtons(guildId, userId)],
    });
    return true;
  }

  if (!interaction.isButton() || !interaction.customId.startsWith(CONSENT)) return false;

  const parts = interaction.customId.slice(CONSENT.length).split(":");
  const isDecline = parts[0] === "no";
  const userId = parts[1];
  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: "This confirmation belongs to another member.",
      ephemeral: true,
    });
    return true;
  }

  if (isDecline) {
    await interaction.update({
      content: "No problem. Your message was not sent to support staff.",
      components: [],
    });
    return true;
  }

  const guildId = parts[0];
  if (!/^\d{17,20}$/.test(guildId || "") || !/^\d{17,20}$/.test(userId || "")) {
    await interaction.update({
      content: "This support confirmation has expired. Please DM OKG Manager again.",
      components: [],
    });
    return true;
  }

  await interaction.deferUpdate();

  try {
    const quoted = String(interaction.message?.content || "");
    const start = quoted.indexOf(MESSAGE_START);
    const end = quoted.indexOf(MESSAGE_END, start + MESSAGE_START.length);
    const firstMessage =
      start >= 0
        ? quoted.slice(start + MESSAGE_START.length, end >= 0 ? end : undefined).trim()
        : "[Original message unavailable]";

    await openConversation(client, userId, guildId, firstMessage);
    await interaction.editReply({
      content:
        "Your message has been sent to OKG support staff. You can continue replying here whenever you need help.",
      components: [],
    });
  } catch (error) {
    console.error("[MODMAIL] Could not open conversation:", error);
    await interaction.editReply({
      content: "We couldn't open your support conversation right now. Please try again later.",
      components: [],
    });
  }

  return true;
}

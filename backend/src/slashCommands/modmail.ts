import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, Message, TextChannel, ThreadChannel } from "discord.js";
import { Configs } from "../data/Configs.js";
import { loadYamlSafely } from "../utils/loadYamlSafely.js";

const CONSENT = "okg_modmail:consent:";
const configs = new Configs();
type ModmailConfig = { guildId: string; inboxChannelId: string; roleId: string };

async function configured(): Promise<ModmailConfig[]> {
  const rows = await configs.getActive();
  const found: ModmailConfig[] = [];
  for (const row of rows) {
    if (!row.key.startsWith("guild-")) continue;
    try {
      const root: any = loadYamlSafely(row.config);
      const support = root?.plugins?.support;
      const cfg = support?.config || {};
      if (support?.enabled === false || cfg.modmail_enabled !== true) continue;
      const guildId = row.key.slice(6);
      if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(cfg.modmail_inbox_channel_id || "") || !/^\d{17,20}$/.test(cfg.modmail_role_id || "")) continue;
      found.push({ guildId, inboxChannelId: cfg.modmail_inbox_channel_id, roleId: cfg.modmail_role_id });
    } catch (error) { console.warn("[MODMAIL] Could not read guild config:", error); }
  }
  return found;
}
function safeText(value: string): string {
  return value.replace(/@everyone/gi, "@ everyone").replace(/@here/gi, "@ here").slice(0, 1800);
}
async function findThread(channel: TextChannel, userId: string): Promise<ThreadChannel | null> {
  const active = await channel.threads.fetchActive();
  let thread = active.threads.find((item) => item.name === "modmail-" + userId);
  if (thread) return thread;
  const archived = await channel.threads.fetchArchived({ type: "public", limit: 100 }).catch(() => null);
  thread = archived?.threads.find((item) => item.name === "modmail-" + userId) || null;
  if (thread?.archived) await thread.setArchived(false).catch(() => undefined);
  return thread;
}
async function sendConsent(message: Message, cfg: ModmailConfig): Promise<void> {
  const content = safeText(message.content || (message.attachments.size ? "[Attachment included]" : "[Message without text]"));
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(CONSENT + cfg.guildId + ":" + message.author.id).setLabel("Yes, contact support").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CONSENT + "no:" + message.author.id).setLabel("No").setStyle(ButtonStyle.Secondary),
  );
  await message.reply({ content: "**Would you like to send this message to OKG support staff?**\n\n> " + content, components: [row], allowedMentions: { parse: [] } });
}
async function openConversation(client: Client, userId: string, guildId: string, firstMessage: string): Promise<void> {
  const cfg = (await configured()).find((item) => item.guildId === guildId);
  if (!cfg) throw new Error("Modmail is not configured.");
  const inbox = await client.channels.fetch(cfg.inboxChannelId);
  if (!(inbox instanceof TextChannel)) throw new Error("The configured Modmail inbox is unavailable.");
  const existing = await findThread(inbox, userId);
  if (existing) {
    await existing.setArchived(false).catch(() => undefined);
    await existing.send("↩️ The member has reopened this conversation.");
    return;
  }
  const user = await client.users.fetch(userId);
  const starter = await inbox.send({
    content: "<@&" + cfg.roleId + "> **New Modmail conversation**\n**Member:** " + user.tag + " (`" + user.id + "`)\n**Reply by writing in this thread.**",
    allowedMentions: { roles: [cfg.roleId], users: [] },
  });
  const thread = await starter.startThread({ name: "modmail-" + userId, autoArchiveDuration: 10080, reason: "OKG Modmail conversation" });
  await thread.send({ content: "**Original message from member:**\n" + safeText(firstMessage || "[No text content]") + "\n\nConversation opened. Staff replies in this thread are delivered to the member by DM.", allowedMentions: { parse: [] } });
}
export async function handleModmailMessage(client: Client, message: Message): Promise<void> {
  if (message.author.bot || message.webhookId) return;
  if (!message.guildId) {
    const all = await configured();
    if (!all.length) return;
    const cfg = all[0];
    const inbox = await client.channels.fetch(cfg.inboxChannelId).catch(() => null);
    if (!(inbox instanceof TextChannel)) return;
    const thread = await findThread(inbox, message.author.id);
    if (thread) {
      await thread.send({ content: "**" + safeText(message.author.tag) + ":**\n" + safeText(message.content || "[Attachment]"), files: [...message.attachments.values()].map((a) => a.url), allowedMentions: { parse: [] } });
      return;
    }
    if (message.content.trim().length || message.attachments.size) await sendConsent(message, cfg);
    return;
  }
  if (!message.channel.isThread()) return;
  const thread = message.channel as ThreadChannel;
  if (!thread.name.startsWith("modmail-")) return;
  const userId = thread.name.slice(7);
  if (!/^\d{17,20}$/.test(userId)) return;
  const cfg = (await configured()).find((item) => item.guildId === message.guildId);
  if (!cfg) return;
  const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
  if (!member?.roles.cache.has(cfg.roleId)) return;
  if (message.content.trim().toLowerCase() === "!close") {
    await thread.send("🔒 Conversation closed by " + safeText(message.author.tag) + ".");
    const user = await client.users.fetch(userId).catch(() => null);
    await user?.send("Your OKG support conversation has been closed. You can DM OKG Manager again if you need further help.").catch(() => undefined);
    await thread.setArchived(true, "Closed by Modmail staff");
    return;
  }
  const body = safeText(message.content || (message.attachments.size ? "[Attachment]" : ""));
  if (!body && !message.attachments.size) return;
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) { await thread.send("Could not deliver: the member is unavailable."); return; }
  try {
    await user.send({ content: "**OKG Support — " + safeText(message.author.tag) + "**\n" + body, files: [...message.attachments.values()].map((a) => a.url), allowedMentions: { parse: [] } });
    await message.react("📨").catch(() => undefined);
  } catch { await thread.send("Delivery failed. The member may have DMs disabled."); }
}
export async function handleModmailInteraction(client: Client, interaction: any): Promise<boolean> {
  if (!interaction.isButton() || !interaction.customId.startsWith(CONSENT)) return false;
  const parts = interaction.customId.slice(CONSENT.length).split(":");
  if (parts[0] === "no") {
    if (interaction.user.id !== parts[1]) { await interaction.reply({ content: "This confirmation belongs to another member.", ephemeral: true }); return true; }
    await interaction.update({ content: "No problem. Your message was not sent to support staff.", components: [] });
    return true;
  }
  const guildId = parts[0], userId = parts[1];
  if (interaction.user.id !== userId) { await interaction.reply({ content: "This confirmation belongs to another member.", ephemeral: true }); return true; }
  await interaction.deferUpdate();
  try {
    const quoted = String(interaction.message?.content || "");
    const firstMessage = quoted.includes("> ") ? quoted.slice(quoted.lastIndexOf("> ") + 2) : "";
    await openConversation(client, userId, guildId, firstMessage);
    await interaction.editReply({ content: "Your message has been sent to OKG support staff. You can continue replying here whenever you need help.", components: [] });
  } catch (error) {
    console.error("[MODMAIL] Could not open conversation:", error);
    await interaction.editReply({ content: "We couldn't open your support conversation right now. Please try again later.", components: [] });
  }
  return true;
}

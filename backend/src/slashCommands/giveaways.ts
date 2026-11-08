import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, Client, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import { randomInt, randomUUID } from "node:crypto";
import { dataSource } from "../data/dataSource.js";
import { Giveaway } from "../data/entities/Giveaway.js";
import { GiveawayEntry } from "../data/entities/GiveawayEntry.js";
import { getUnbelievaBoatToken } from "./unbelievaboat.js";

const giveawayRepo = () => dataSource.getRepository(Giveaway);
const entryRepo = () => dataSource.getRepository(GiveawayEntry);
const PREFIX = "okg_giveaway:enter:";
const COLOR = 0x6d5dfb;
const completionLocks = new Set<string>();

function durationMs(value: string): number | null {
  const match = value.trim().match(/^(\d{1,4})(m|h|d)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const ms = amount * (unit === "m" ? 60000 : unit === "h" ? 3600000 : 86400000);
  return Number.isSafeInteger(ms) && ms >= 60000 && ms <= 2592000000 ? ms : null;
}
function winnerIds(g: Giveaway): string[] {
  try { const value = JSON.parse(g.winner_ids || "[]"); return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : []; }
  catch { return []; }
}
function row(id: string, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PREFIX + id)
      .setLabel(disabled ? "Entries closed" : "Enter giveaway")
      .setEmoji("🎟️")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
  );
}
async function embed(g: Giveaway): Promise<EmbedBuilder> {
  const count = await entryRepo().count({ where: { giveaway_id: g.id } });
  const end = new Date(g.ends_at);
  const winners = winnerIds(g).slice(-g.winner_count);
  const active = g.status === "active";
  const result = new EmbedBuilder()
    .setColor(active ? COLOR : 0x238b68)
    .setAuthor({ name: "ONE KID GAMING  /  COMMUNITY EVENTS" })
    .setTitle(g.title)
    .setDescription(
      [g.description?.trim(), active ? "Select **Enter giveaway** below to join. Each member may enter once." : "This event is closed. Thank you to everyone who participated."]
        .filter(Boolean)
        .join("\n\n"),
    )
    .addFields(
      { name: "PRIZE", value: g.prize, inline: false },
      { name: "WINNERS", value: String(g.winner_count), inline: true },
      { name: "ENTRIES", value: String(count), inline: true },
      {
        name: active ? "TIME REMAINING" : "ENDED",
        value: active ? "<t:" + Math.floor(end.getTime() / 1000) + ":R>" : "<t:" + Math.floor(end.getTime() / 1000) + ":f>",
        inline: true,
      },
    )
    .setFooter({ text: "OKG Manager • " + (g.kind === "raffle" ? "Raffle" : "Giveaway") + " • Event " + g.id })
    .setTimestamp(new Date(g.created_at));
  if (g.required_role_id) result.addFields({ name: "ENTRY REQUIREMENT", value: "<@&" + g.required_role_id + ">", inline: true });
  if (g.cash_reward) {
    result.addFields(
      { name: "CASH PRIZE", value: g.cash_reward.toLocaleString() + " per winner", inline: true },
      { name: "PAYOUT STATUS", value: g.payout_status === "paid" ? "Paid" : g.payout_status === "partial" ? "Partially paid — review required" : g.payout_status === "pending" ? "Pending review" : "Configured", inline: true },
    );
  }
  if (winners.length) {
    result.addFields({ name: "SELECTED WINNERS", value: winners.map((id) => "<@!" + id + ">").join(", ") });
  }
  return result;
}
async function refresh(client: Client, g: Giveaway): Promise<void> {
  try {
    const channel = await client.channels.fetch(g.channel_id);
    if (!(channel instanceof TextChannel)) return;
    const message = await channel.messages.fetch(g.message_id);
    await message.edit({ embeds: [await embed(g)], components: [row(g.id, g.status !== "active")] });
  } catch (error) { console.warn("[GIVEAWAYS] Post refresh failed:", error); }
}
async function pay(g: Giveaway, userId: string): Promise<void> {
  const token = await getUnbelievaBoatToken(g.guild_id);
  if (!token || !g.cash_reward) throw new Error("UnbelievaBoat payout is not configured.");
  const response = await fetch("https://unbelievaboat.com/api/v1/guilds/" + encodeURIComponent(g.guild_id) + "/users/" + encodeURIComponent(userId), {
    method: "PATCH",
    headers: { Authorization: token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ cash: g.cash_reward, reason: "OKG Manager " + g.kind + " prize: " + g.title.slice(0, 80) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("UnbelievaBoat HTTP " + response.status + ": " + (await response.text()).slice(0, 200));
}
async function draw(g: Giveaway, reroll: boolean): Promise<string[]> {
  const rows = await entryRepo().find({ where: { giveaway_id: g.id } });
  const excluded = new Set(reroll ? winnerIds(g) : []);
  const pool = rows.map((entry) => entry.user_id).filter((id) => !excluded.has(id));
  const selected: string[] = [];
  while (pool.length && selected.length < g.winner_count) selected.push(pool.splice(randomInt(pool.length), 1)[0]);
  return selected;
}
async function complete(client: Client, g: Giveaway, reroll = false): Promise<string[]> {
  if (completionLocks.has(g.id)) throw new Error("This event is already being processed.");
  if (!reroll && g.status !== "active") return winnerIds(g);
  if (reroll && g.status !== "completed") throw new Error("Only completed events can be rerolled.");

  completionLocks.add(g.id);
  try {
    const selected = await draw(g, reroll);

    // Persist the draw before making external payment requests. If the process stops
    // during a payout, the scheduler cannot accidentally draw and pay a second time.
    g.winner_ids = JSON.stringify(reroll ? winnerIds(g).concat(selected) : selected);
    g.status = "completed";
    if (g.cash_reward && selected.length) g.payout_status = "pending";
    await giveawayRepo().save(g);
    await refresh(client, g);

    if (g.cash_reward && selected.length) {
      let paid = 0;
      for (const userId of selected) {
        try {
          await pay(g, userId);
          paid++;
        } catch {
          // Avoid logging provider response bodies or credentials. A failed/ambiguous
          // transfer is left for manual review rather than retried automatically.
          console.error("[GIVEAWAYS] Cash payout requires review for event " + g.id + " and winner " + userId);
        }
      }
      g.payout_status = paid === selected.length ? "paid" : paid ? "partial" : "pending";
      await giveawayRepo().save(g);
      await refresh(client, g);
    }
    return selected;
  } finally {
    completionLocks.delete(g.id);
  }
}

export const giveawayCommand = new SlashCommandBuilder().setName("giveaway").setDescription("Create and manage giveaways and raffles")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName("create").setDescription("Create a button-entry event")
    .addStringOption((o) => o.setName("title").setDescription("Event title").setRequired(true).setMaxLength(180))
    .addStringOption((o) => o.setName("prize").setDescription("Prize details").setRequired(true).setMaxLength(500))
    .addStringOption((o) => o.setName("duration").setDescription("Examples: 30m, 6h, 2d (max 30d)").setRequired(true))
    .addIntegerOption((o) => o.setName("winners").setDescription("Number of winners").setMinValue(1).setMaxValue(20))
    .addStringOption((o) => o.setName("type").setDescription("Event type").addChoices({name:"Giveaway",value:"giveaway"},{name:"Raffle",value:"raffle"}))
    .addChannelOption((o) => o.setName("channel").setDescription("Post channel"))
    .addRoleOption((o) => o.setName("required-role").setDescription("Optional entry role"))
    .addIntegerOption((o) => o.setName("cash-reward").setDescription("Optional UnbelievaBoat cash per winner").setMinValue(1).setMaxValue(1000000000))
    .addStringOption((o) => o.setName("description").setDescription("Optional details").setMaxLength(1000)))
  .addSubcommand((s) => s.setName("end").setDescription("End an event early").addStringOption((o) => o.setName("id").setDescription("Event ID").setRequired(true)))
  .addSubcommand((s) => s.setName("reroll").setDescription("Draw replacement winner(s)").addStringOption((o) => o.setName("id").setDescription("Completed event ID").setRequired(true)))
  .addSubcommand((s) => s.setName("list").setDescription("List active events"));

function canManage(i: ChatInputCommandInteraction): boolean {
  return Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || i.memberPermissions?.has(PermissionFlagsBits.Administrator));
}
export async function handleGiveawayCommand(i: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!i.inGuild() || !i.guildId) { await i.reply({ content: "Use this command in a server.", ephemeral: true }); return; }
  const action = i.options.getSubcommand();
  if (action !== "list" && !canManage(i)) { await i.reply({ content: "You need Manage Server permission.", ephemeral: true }); return; }
  if (action === "create") {
    const ms = durationMs(i.options.getString("duration", true));
    if (!ms) { await i.reply({ content: "Invalid duration. Use 30m, 6h, or 2d (1 minute to 30 days).", ephemeral: true }); return; }
    const channel = i.options.getChannel("channel") ?? i.channel;
    if (!(channel instanceof TextChannel)) { await i.reply({ content: "Choose a standard text channel.", ephemeral: true }); return; }
    await i.deferReply({ ephemeral: true });
    const g = giveawayRepo().create({
      id: randomUUID().replace(/-/g, "").slice(0, 24), guild_id: i.guildId, channel_id: channel.id, message_id: "pending",
      host_id: i.user.id, title: i.options.getString("title", true), description: i.options.getString("description") || "",
      prize: i.options.getString("prize", true), kind: i.options.getString("type") || "giveaway",
      winner_count: i.options.getInteger("winners") || 1, required_role_id: i.options.getRole("required-role")?.id || null,
      cash_reward: i.options.getInteger("cash-reward"), ends_at: new Date(Date.now() + ms), status: "active",
      winner_ids: "[]", payout_status: "none", created_at: new Date(),
    });
    try {
      await giveawayRepo().save(g);
      const post = await channel.send({ embeds: [await embed(g)], components: [row(g.id)], allowedMentions: { parse: [], users: [], roles: [] } });
      g.message_id = post.id;
      await giveawayRepo().save(g);
      await i.editReply("Created " + g.kind + " " + g.id + " in <#" + channel.id + ">. It ends <t:" + Math.floor(g.ends_at.getTime()/1000) + ":R>.");
    } catch (error) {
      await giveawayRepo().delete({ id: g.id });
      console.error("[GIVEAWAYS] Create failed:", error);
      await i.editReply("Could not publish the event. Check my channel and Embed Links permissions.");
    }
    return;
  }
  if (action === "list") {
    const active = await giveawayRepo().find({ where: { guild_id: i.guildId, status: "active" }, order: { ends_at: "ASC" }, take: 15 });
    if (!active.length) { await i.reply({ content: "No active giveaways or raffles.", ephemeral: true }); return; }
    const lines = await Promise.all(active.map(async (g) => {
      const count = await entryRepo().count({ where: { giveaway_id: g.id } });
      return "• **" + g.title + "** (" + g.kind + ") — " + count + " entries — ends <t:" + Math.floor(new Date(g.ends_at).getTime()/1000) + ":R> — ID: " + g.id;
    }));
    await i.reply({ content: lines.join("\n"), ephemeral: true }); return;
  }
  const id = i.options.getString("id", true);
  const g = await giveawayRepo().findOne({ where: { id, guild_id: i.guildId } });
  if (!g) { await i.reply({ content: "Event not found. Use /giveaway list to see active IDs.", ephemeral: true }); return; }
  if (action === "end") {
    if (g.status !== "active") { await i.reply({ content: "That event has already ended.", ephemeral: true }); return; }
    await i.deferReply({ ephemeral: true });
    try {
      const winners = await complete(client, g);
      await i.editReply(winners.length ? "Winner(s): " + winners.map((id) => "<@!" + id + ">").join(", ") : "Event ended with no eligible entries.");
    } catch {
      await i.editReply("The event could not be completed right now. No automatic retry or duplicate draw was started; please try again shortly.");
    }
    return;
  }
  if (action === "reroll") {
    if (g.status !== "completed") { await i.reply({ content: "The event must be completed before rerolling.", ephemeral: true }); return; }
    await i.deferReply({ ephemeral: true });
    try {
      const winners = await complete(client, g, true);
      await i.editReply(winners.length ? "Replacement winner(s): " + winners.map((id) => "<@!" + id + ">").join(", ") : "No remaining entrants to reroll.");
    } catch {
      await i.editReply("The reroll could not be completed right now. Please try again shortly.");
    }
  }
}

export async function handleGiveawayButton(i: any, client: Client): Promise<boolean> {
  if (!i.isButton() || !i.customId.startsWith(PREFIX)) return false;
  const id = i.customId.slice(PREFIX.length);
  const g = await giveawayRepo().findOne({ where: { id, guild_id: i.guildId } });
  if (!g || g.status !== "active" || new Date(g.ends_at).getTime() <= Date.now()) {
    if (g?.status === "active") await complete(client, g);
    await i.reply({ content: "This event has ended or is unavailable.", ephemeral: true }); return true;
  }
  if (g.required_role_id) {
    const member = await i.guild.members.fetch(i.user.id);
    if (!member.roles.cache.has(g.required_role_id)) {
      await i.reply({ content: "You need <@&" + g.required_role_id + "> to enter.", ephemeral: true }); return true;
    }
  }
  const old = await entryRepo().findOne({ where: { giveaway_id: id, user_id: i.user.id } });
  if (old) {
    await i.reply({ content: "You're already entered. Each member can enter this event once.", ephemeral: true });
    return true;
  }

  try {
    await entryRepo().insert({ giveaway_id: id, user_id: i.user.id, entered_at: new Date() });
    await i.reply({ content: "Your entry is confirmed. Good luck!", ephemeral: true });
  } catch {
    await i.reply({ content: "Your entry is already registered.", ephemeral: true });
    return true;
  }
  await refresh(client, g);
  return true;
}
export function startGiveawayEndingLoop(client: Client): void {
  let running = false;
  const check = async () => {
    if (running || !dataSource.isInitialized) return;
    running = true;
    try {
      const active = await giveawayRepo().find({ where: { status: "active" }, take: 100 });
      for (const g of active) if (new Date(g.ends_at).getTime() <= Date.now()) {
        try { await complete(client, g); } catch (error) { console.error("[GIVEAWAYS] End failed:", error); }
      }
    } catch (error) { console.error("[GIVEAWAYS] Scheduler failed:", error); }
    finally { running = false; }
  };
  void check();
  setInterval(() => void check(), 30000);
}

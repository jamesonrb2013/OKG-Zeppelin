import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { getUnbelievaBoatToken } from "./unbelievaboat.js";

type Balance = {
  user_id: string;
  cash: number;
  bank: number;
  total: number;
  rank?: string | number;
};

type EconomyGuild = {
  currencySymbol?: string;
};

const API = "https://unbelievaboat.com/api/v1";

function isModerator(i: ChatInputCommandInteraction): boolean {
  return Boolean(
    i.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ||
    i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    i.memberPermissions?.has(PermissionFlagsBits.Administrator),
  );
}

async function request<T>(token: string, path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(API + path, {
    method,
    headers: {
      Authorization: token,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("The saved UnbelievaBoat token was rejected. Ask a server administrator to reconnect it.");
    }
    if (response.status === 404) throw new Error("UnbelievaBoat could not find that member or server.");
    if (response.status === 429) throw new Error("UnbelievaBoat is rate-limiting requests. Please wait and try again.");
    throw new Error("UnbelievaBoat returned HTTP " + response.status + ".");
  }

  return (await response.json()) as T;
}

async function currencySymbol(token: string, guildId: string): Promise<string> {
  try {
    const guild = await request<EconomyGuild>(token, "/guilds/" + encodeURIComponent(guildId));
    return guild.symbol || "";
  } catch {
    return "$";
  }
}

function amount(value: number, symbol: string): string {
  return symbol + value.toLocaleString("en-US");
}

function validBalance(balance: Balance): boolean {
  return [balance.cash, balance.bank, balance.total].every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  );
}

export const economyCommand = new SlashCommandBuilder()
  .setName("economy")
  .setDescription("View and manage this server's UnbelievaBoat economy")
  .addSubcommand((s) =>
    s.setName("balance")
      .setDescription("View a member's cash and bank balance")
      .addUserOption((o) => o.setName("member").setDescription("Member to inspect; defaults to you")),
  )
  .addSubcommand((s) =>
    s.setName("add")
      .setDescription("Add cash or bank funds to a member (moderators)")
      .addUserOption((o) => o.setName("member").setDescription("Member receiving funds").setRequired(true))
      .addIntegerOption((o) => o.setName("amount").setDescription("Amount to add").setMinValue(1).setMaxValue(2147483647).setRequired(true))
      .addStringOption((o) => o.setName("account").setDescription("Which balance to change").addChoices({ name: "Cash", value: "cash" }, { name: "Bank", value: "bank" }).setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason recorded in the economy audit log").setMaxLength(200)),
  )
  .addSubcommand((s) =>
    s.setName("remove")
      .setDescription("Remove cash or bank funds from a member (moderators)")
      .addUserOption((o) => o.setName("member").setDescription("Member losing funds").setRequired(true))
      .addIntegerOption((o) => o.setName("amount").setDescription("Amount to remove").setMinValue(1).setMaxValue(2147483647).setRequired(true))
      .addStringOption((o) => o.setName("account").setDescription("Which balance to change").addChoices({ name: "Cash", value: "cash" }, { name: "Bank", value: "bank" }).setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason recorded in the economy audit log").setMaxLength(200)),
  )
  .addSubcommand((s) =>
    s.setName("set")
      .setDescription("Set a member's cash or bank balance (moderators)")
      .addUserOption((o) => o.setName("member").setDescription("Member to update").setRequired(true))
      .addIntegerOption((o) => o.setName("amount").setDescription("New balance").setMinValue(0).setMaxValue(2147483647).setRequired(true))
      .addStringOption((o) => o.setName("account").setDescription("Which balance to set").addChoices({ name: "Cash", value: "cash" }, { name: "Bank", value: "bank" }).setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason recorded in the economy audit log").setMaxLength(200).setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName("reset")
      .setDescription("Reset one member's cash and bank balances to zero (administrators)")
      .addUserOption((o) => o.setName("member").setDescription("Member to reset").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason for this reset").setMaxLength(200).setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName("leaderboard")
      .setDescription("View the server economy leaderboard")
      .addStringOption((o) => o.setName("sort").setDescription("Balance used for ranking").addChoices({ name: "Total", value: "total" }, { name: "Cash", value: "cash" }, { name: "Bank", value: "bank" }))
      .addIntegerOption((o) => o.setName("page").setDescription("Leaderboard page").setMinValue(1).setMaxValue(100)),
  );

export async function handleEconomyCommand(i: ChatInputCommandInteraction): Promise<void> {
  if (!i.inGuild() || !i.guildId) {
    await i.reply({ content: "Use this command inside a server.", ephemeral: true });
    return;
  }

  const action = i.options.getSubcommand();
  const moderatorAction = ["add", "remove", "set", "reset"].includes(action);
  if (moderatorAction && !isModerator(i)) {
    await i.reply({ content: "You need the **Manage Messages** permission (or Manage Server / Administrator) to manage server balances.", ephemeral: true });
    return;
  }
  if (action === "reset" && !i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && !i.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await i.reply({ content: "Only server managers or administrators can reset a member's entire economy balance.", ephemeral: true });
    return;
  }

  await i.deferReply({ ephemeral: action !== "leaderboard" });
  try {
    const token = await getUnbelievaBoatToken(i.guildId);
    if (!token) {
      await i.editReply("UnbelievaBoat is not connected for this server. A server administrator must configure it in **Features → UnbelievaBoat** first.");
      return;
    }
    const symbol = await currencySymbol(token, i.guildId);

    if (action === "balance") {
      const member = i.options.getUser("member") ?? i.user;
      const balance = await request<Balance>(token, "/guilds/" + i.guildId + "/users/" + member.id);
      if (!validBalance(balance)) throw new Error("UnbelievaBoat returned an invalid balance.");
      const card = new EmbedBuilder()
        .setColor(0x6d5dfb)
        .setAuthor({ name: "SERVER ECONOMY" })
        .setTitle(member.username + "'s balance")
        .setThumbnail(member.displayAvatarURL())
        .addFields(
          { name: "CASH", value: amount(balance.cash, symbol), inline: true },
          { name: "BANK", value: amount(balance.bank, symbol), inline: true },
          { name: "TOTAL", value: amount(balance.total, symbol), inline: true },
        )
        .setFooter({ text: "OKG Manager • UnbelievaBoat" });
      if (balance.rank) card.addFields({ name: "LEADERBOARD RANK", value: "#" + balance.rank, inline: true });
      await i.editReply({ embeds: [card] });
      return;
    }

    if (action === "leaderboard") {
      const sort = i.options.getString("sort") || "total";
      const page = i.options.getInteger("page") || 1;
      const result = await request<{ users: Balance[]; total_pages: number }>(
        token,
        "/guilds/" + i.guildId + "/users?sort=" + sort + "&limit=10&page=" + page,
      );
      const lines = (result.users || []).map((user, index) =>
        "**" + ((page - 1) * 10 + index + 1) + ".** <@" + user.user_id + "> — " + amount(
          sort === "cash" ? user.cash : sort === "bank" ? user.bank : user.total,
          symbol,
        ),
      );
      const card = new EmbedBuilder()
        .setColor(0x6d5dfb)
        .setAuthor({ name: "SERVER ECONOMY" })
        .setTitle("Economy leaderboard")
        .setDescription(lines.length ? lines.join("\n") : "No economy accounts were found.")
        .setFooter({ text: "Sorted by " + sort + " • Page " + page + " of " + (result.total_pages || 1) });
      await i.editReply({ embeds: [card] });
      return;
    }

    const member = i.options.getUser("member", true);
    const reason = (i.options.getString("reason") || "OKG Manager action by " + i.user.username).slice(0, 200);
    const base = "/guilds/" + i.guildId + "/users/" + member.id;

    if (action === "add" || action === "remove") {
      const value = i.options.getInteger("amount", true) * (action === "remove" ? -1 : 1);
      const account = i.options.getString("account", true) as "cash" | "bank";
      const updated = await request<Balance>(token, base, "PATCH", { [account]: value, reason });
      if (!validBalance(updated)) throw new Error("UnbelievaBoat returned an invalid updated balance.");
      await i.editReply(
        (action === "add" ? "Added " : "Removed ") + amount(Math.abs(value), symbol) + " " + account +
        " for <@" + member.id + ">. New balance: " + amount(updated[account], symbol) + ".\n**Reason:** " + reason,
      );
      return;
    }

    if (action === "set") {
      const account = i.options.getString("account", true) as "cash" | "bank";
      const value = i.options.getInteger("amount", true);
      const current = await request<Balance>(token, base);
      if (!validBalance(current)) throw new Error("UnbelievaBoat returned an invalid current balance.");
      const updated = await request<Balance>(token, base, "PUT", {
        cash: account === "cash" ? value : current.cash,
        bank: account === "bank" ? value : current.bank,
        reason,
      });
      if (!validBalance(updated)) throw new Error("UnbelievaBoat returned an invalid updated balance.");
      await i.editReply(
        "Set <@" + member.id + ">'s " + account + " balance to " + amount(value, symbol) +
        ".\n**Reason:** " + reason,
      );
      return;
    }

    if (action === "reset") {
      const updated = await request<Balance>(token, base, "PUT", { cash: 0, bank: 0, reason });
      if (!validBalance(updated)) throw new Error("UnbelievaBoat returned an invalid updated balance.");
      await i.editReply("Reset <@" + member.id + ">'s cash and bank balances to zero.\n**Reason:** " + reason);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The economy request failed.";
    await i.editReply("⚠️ " + message);
  }
}

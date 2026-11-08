import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  Client,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../env.js";
import { Configs } from "../data/Configs.js";

const configs = new Configs();
const KEY = Buffer.from(env.KEY, "utf8");
const PREFIX = "unbelievaboat:";

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
}

function decryptToken(value: string): string {
  const stored = JSON.parse(value) as { version: number; iv: string; tag: string; data: string };
  if (stored.version !== 1) throw new Error("Unsupported credential format.");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(stored.iv, "base64"));
  decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(stored.data, "base64")), decipher.final()]).toString("utf8");
}

export async function getUnbelievaBoatToken(guildId: string): Promise<string | null> {
  const saved = await configs.getActiveByKey(PREFIX + guildId);
  if (!saved || !saved.config) return null;
  try {
    const parsed = JSON.parse(saved.config) as { encryptedToken?: string };
    return parsed.encryptedToken ? decryptToken(parsed.encryptedToken) : null;
  } catch {
    throw new Error("The saved UnbelievaBoat credential could not be decrypted. Reconnect it in server settings.");
  }
}

export async function connectUnbelievaBoatGuild(guildId: string, token: string, editedBy: string): Promise<void> {
  const response = await fetch("https://unbelievaboat.com/api/v1/guilds/" + encodeURIComponent(guildId), {
    method: "GET",
    headers: { Authorization: token, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("UnbelievaBoat rejected this token or it does not have access to this server.");
    if (response.status === 404) throw new Error("UnbelievaBoat could not find this Discord server for the supplied token.");
    throw new Error("UnbelievaBoat connection test failed (HTTP " + response.status + ").");
  }
  const guild = (await response.json()) as { id?: string };
  if (guild.id !== guildId) throw new Error("The token did not validate for this Discord server.");
  await configs.saveNewRevision(PREFIX + guildId, JSON.stringify({ encryptedToken: encryptToken(token) }), editedBy);
}

export async function disconnectUnbelievaBoatGuild(guildId: string, editedBy: string): Promise<void> {
  await configs.saveNewRevision(PREFIX + guildId, "", editedBy);
}

export async function hasUnbelievaBoatConnection(guildId: string): Promise<boolean> {
  const saved = await configs.getActiveByKey(PREFIX + guildId);
  if (!saved?.config) return false;
  try {
    const parsed = JSON.parse(saved.config) as { encryptedToken?: string };
    return Boolean(parsed.encryptedToken && decryptToken(parsed.encryptedToken));
  } catch {
    return false;
  }
}

export const unbelievaboatCommand = new SlashCommandBuilder()
  .setName("unbelievaboat")
  .setDescription("Configure this server's UnbelievaBoat connection")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName("connect").setDescription("Connect or replace this server's API token"))
  .addSubcommand((s) => s.setName("status").setDescription("Check this server's connection status"))
  .addSubcommand((s) => s.setName("disconnect").setDescription("Remove this server's saved API token"));

export async function handleUnbelievaBoatCommand(i: ChatInputCommandInteraction, _client: Client): Promise<void> {
  if (!i.inGuild() || !i.guildId) {
    await i.reply({ content: "Use this command inside the server you want to configure.", ephemeral: true });
    return;
  }
  if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && !i.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await i.reply({ content: "You need Manage Server permission to change this integration.", ephemeral: true });
    return;
  }

  const action = i.options.getSubcommand();
  const key = PREFIX + i.guildId;
  if (action === "connect") {
    const modal = new ModalBuilder().setCustomId("okg_unbelievaboat:connect").setTitle("Connect UnbelievaBoat");
    const token = new TextInputBuilder()
      .setCustomId("token")
      .setLabel("UnbelievaBoat API token")
      .setPlaceholder("Paste the token from your UnbelievaBoat account")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(20)
      .setMaxLength(2048);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(token));
    await i.showModal(modal);
    return;
  }

  if (action === "disconnect") {
    await disconnectUnbelievaBoatGuild(i.guildId, i.user.id);
    await i.reply({ content: "UnbelievaBoat has been disconnected for this server. Existing giveaways and raffles still work; cash payouts will require reconnecting.", ephemeral: true });
    return;
  }

  const saved = await configs.getActiveByKey(key);
  await i.reply({
    content: saved?.config
      ? "🟢 UnbelievaBoat is connected for this server. The saved token is encrypted and cannot be viewed here."
      : "⚪ UnbelievaBoat is not connected for this server. Use /unbelievaboat connect to add this server's token.",
    ephemeral: true,
  });
}

export async function handleUnbelievaBoatModal(i: any, _client: Client): Promise<void> {
  if (!i.guildId || !i.guild || !i.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && !i.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await i.reply({ content: "You need Manage Server permission in the server you are configuring.", ephemeral: true });
    return;
  }
  const token = String(i.fields.getTextInputValue("token") || "").trim();
  if (token.length < 20 || /\s/.test(token)) {
    await i.reply({ content: "That token format doesn't look valid. Copy the complete token and try again.", ephemeral: true });
    return;
  }
  await i.deferReply({ ephemeral: true });
  try {
    await connectUnbelievaBoatGuild(i.guildId, token, i.user.id);
    await i.editReply("🟢 **Connected!** This server's UnbelievaBoat token was tested and saved encrypted. Cash prizes in this server's giveaways and raffles can now be paid out.");
  } catch {
    // Do not log the request, response body, or credential.
    await i.editReply("Could not verify the UnbelievaBoat connection. Please try again later. Your token was not saved.");
  }
}

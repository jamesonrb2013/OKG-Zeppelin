import { Client, Events, Message } from "discord.js";
import type { Vety } from "vety";
import type { AllowedGuilds } from "../data/AllowedGuilds.js";
import { BOT_VERSION } from "../version.js";
import { logger } from "../logger.js";

export const OKG_PLATFORM_OWNER_ID = "1441223435043868735";

const INTERNAL_COMMAND_PREFIX = "!";
const CANONICAL_OKG_PREFIX = "!o";

export function extractPrefixedCommand(content: string, configuredPrefix = "!o "): string | null {
  const candidates = [CANONICAL_OKG_PREFIX, configuredPrefix.trimEnd()]
    .filter((prefix) => prefix.length > 0)
    .sort((a, b) => b.length - a.length);

  for (const prefix of candidates) {
    if (content.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) continue;
    const remainder = content.slice(prefix.length);
    const firstCharacter = remainder.charAt(0);
    const hasSeparator = [" ", "\t", "\n", "\r"].includes(firstCharacter);
    if (prefix.toLowerCase() === CANONICAL_OKG_PREFIX && remainder.length > 0 && !hasSeparator) continue;
    return remainder.trim();
  }
  return null;
}

/** Create the rewritten Message exactly as Vety documents; Message.content is inherited via an accessor. */
export function createForwardedPrefixMessage(message: Message, content: string): Message {
  return Object.create(message, {
    content: { configurable: true, enumerable: true, writable: true, value: content },
  }) as Message;
}

function getHealthCommand(commandText: string): "ping" | "keepalive" | null {
  const words = commandText.trim().toLowerCase().split(/\s+/);
  if (words[0] === "ping") return "ping";
  if (words[0] === "keepalive" || (words[0] === "keep" && words[1] === "alive")) return "keepalive";
  return null;
}

function getUptimeText(): string {
  const totalSeconds = Math.floor(process.uptime());
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours + "h " + minutes + "m " + seconds + "s";
}

async function replyToHealthCheck(message: Message, source: "discord" | "webhook"): Promise<void> {
  await message.reply({
    content: [
      "🟢 **Pong! OKG Manager is online and responding.**",
      "Version: " + BOT_VERSION,
      "Uptime: " + getUptimeText(),
      source === "webhook"
        ? "Dyno webhook received. This confirms the bot is running; a Discord webhook cannot start a stopped hosting worker."
        : "Health check: `!o ping` / `!o keep alive`",
    ].join("\n"),
    allowedMentions: { parse: [], repliedUser: false },
  });
}

/** One entry point for every public OKG message-prefix command. */
export function registerPrefixCommandDispatcher(
  client: Client,
  vety: Vety,
  allowedGuilds: AllowedGuilds,
  getConfiguredPrefix: (guildId: string) => string,
): void {
  const directHealthCooldowns = new Map<string, number>();
  const webhookHealthCooldowns = new Map<string, number>();

  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guildId || !message.guild || !message.content) return;

      const configuredPrefix = getConfiguredPrefix(message.guildId) || "!o ";
      // When a guild deliberately configures "!" Vety already handles that
      // prefix natively; forwarding it again would execute the same command twice.
      const publicPrefix = configuredPrefix.trimEnd() === "!" ? "!o " : configuredPrefix;
      const commandText = extractPrefixedCommand(message.content.trimStart(), publicPrefix);
      const isWebhook = Boolean(message.webhookId);
      const ownerWasMentioned =
        message.content.includes("<@" + OKG_PLATFORM_OWNER_ID + ">") ||
        message.content.includes("<@!" + OKG_PLATFORM_OWNER_ID + ">");

      // Webhooks are accepted only for the authenticated Dyno health-check path.
      if (isWebhook) {
        if (commandText == null || !ownerWasMentioned || !getHealthCommand(commandText)) return;
        if (!(await allowedGuilds.isAllowed(message.guildId))) return;

        const healthCommand = getHealthCommand(commandText)!;
        const cooldownKey = message.guildId + ":" + message.webhookId + ":" + healthCommand;
        const now = Date.now();
        const previous = webhookHealthCooldowns.get(cooldownKey) ?? 0;
        if (now - previous < 55 * 60 * 1000) return;

        webhookHealthCooldowns.set(cooldownKey, now);
        await replyToHealthCheck(message, "webhook");
        logger.info("Accepted Dyno webhook " + healthCommand + " in guild " + message.guildId);
        return;
      }

      if (message.author.bot) return;

      const botUser = client.user;
      const botWasMentioned = Boolean(botUser && message.mentions.users.has(botUser.id));
      if (commandText == null && !botWasMentioned) return;
      if (!(await allowedGuilds.isAllowed(message.guildId))) return;

      if (botWasMentioned && commandText == null) {
        const cooldownKey = message.guildId + ":" + message.author.id;
        const now = Date.now();
        const previous = directHealthCooldowns.get(cooldownKey) ?? 0;
        if (now - previous >= 3000) {
          directHealthCooldowns.set(cooldownKey, now);
          await replyToHealthCheck(message, "discord");
        }
        return;
      }

      if (commandText == null) return;

      if (commandText === "") {
        await message.reply({
          content: "The OKG Manager prefix is `!o`. Try `!o help` to see available commands.",
          allowedMentions: { parse: [], repliedUser: false },
        });
        return;
      }

      const healthCommand = getHealthCommand(commandText);
      if (healthCommand) {
        const cooldownKey = message.guildId + ":" + message.author.id;
        const now = Date.now();
        const previous = directHealthCooldowns.get(cooldownKey) ?? 0;
        if (now - previous >= 3000) {
          directHealthCooldowns.set(cooldownKey, now);
          await replyToHealthCheck(message, "discord");
        }
        return;
      }

      // Vety's native listener sees the original "!o ..." message as command "o".
      // Dispatch a copy using the one internal prefix that Vety is configured for.
      const forwardedMessage = createForwardedPrefixMessage(message, INTERNAL_COMMAND_PREFIX + commandText);

      logger.info(
        "Dispatching OKG prefix command " +
          JSON.stringify(commandText.split(/\s+/)[0]) +
          " from " +
          message.author.id +
          " in guild " +
          message.guildId,
      );
      await vety.dispatchMessageCommands(forwardedMessage);
    } catch (error) {
      logger.error(
        "[PREFIX] Command dispatch failed: " +
          (error instanceof Error ? error.stack ?? error.message : String(error)),
      );
    }
  });
}

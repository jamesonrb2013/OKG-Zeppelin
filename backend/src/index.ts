// KEEP THIS AS FIRST IMPORT
// See comment in module for details
import "./threadsSignalFix.js";

import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  Options,
  Partials,
  RESTEvents,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { Vety, PluginError, PluginLoadError, PluginNotLoadedError, getDefaultMessageCommandPrefix } from "vety";
import moment from "moment-timezone";
import { performance } from "perf_hooks";
import process from "process";
import { DiscordJSError } from "./DiscordJSError.js";
import { RecoverablePluginError } from "./RecoverablePluginError.js";
import { SimpleError } from "./SimpleError.js";
import { AllowedGuilds } from "./data/AllowedGuilds.js";
import { Configs } from "./data/Configs.js";
import { FishFishError, initFishFish } from "./data/FishFish.js";
import { GuildLogs } from "./data/GuildLogs.js";
import { LogType } from "./data/LogType.js";
import { dataSource } from "./data/dataSource.js";
import { connect } from "./data/db.js";
import { runExpiredArchiveDeletionLoop } from "./data/loops/expiredArchiveDeletionLoop.js";
import { runExpiredMemberCacheDeletionLoop } from "./data/loops/expiredMemberCacheDeletionLoop.js";
import { runExpiringMutesLoop } from "./data/loops/expiringMutesLoop.js";
import { runExpiringTempbansLoop } from "./data/loops/expiringTempbansLoop.js";
import { runExpiringVCAlertsLoop } from "./data/loops/expiringVCAlertsLoop.js";
import { runMemberCacheDeletionLoop } from "./data/loops/memberCacheDeletionLoop.js";
import { runSavedMessageCleanupLoop } from "./data/loops/savedMessageCleanupLoop.js";
import { runUpcomingRemindersLoop } from "./data/loops/upcomingRemindersLoop.js";
import { runUpcomingScheduledPostsLoop } from "./data/loops/upcomingScheduledPostsLoop.js";
import { consumeQueryStats } from "./data/queryLogger.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { availableGlobalPlugins, availableGuildPlugins } from "./plugins/availablePlugins.js";
import { setProfiler } from "./profiler.js";
import { logRateLimit } from "./rateLimitStats.js";
import { startUptimeCounter } from "./uptime.js";
import {
  MINUTES,
  SECONDS,
  errorMessage,
  isDiscordAPIError,
  isDiscordHTTPError,
  sleep,
  successMessage,
} from "./utils.js";
import { DecayingCounter } from "./utils/DecayingCounter.js";
import { enableProfiling } from "./utils/easyProfiler.js";
import { loadYamlSafely } from "./utils/loadYamlSafely.js";
import { announceCommand, handleAnnounceCommand } from "./slashCommands/announce.js";
import { aiAdminCommand, aiConfigCommand, aiSetupCommand, aiStatusCommand, handleAICommand, handleAIMessage } from "./slashCommands/ai.js";
import { permissionLevelCommand, handlePermissionLevelCommand } from "./slashCommands/permissionLevel.js";
import {
  handleSupportInteraction,
  handleSupportModal,
  handleSupportPanelCommand,
  supportPanelCommand,
} from "./slashCommands/support.js";
import {
  handleUpdatesConfig,
  handleUpdatesSetup,
  postGuildUpdate,
  updatesConfigCommand,
  updatesSetupCommand,
} from "./slashCommands/updates.js";

const BOT_VERSION = "1.3.9";

// Error handling
let recentPluginErrors = 0;
const RECENT_PLUGIN_ERROR_EXIT_THRESHOLD = 5;

let recentDiscordErrors = 0;
const RECENT_DISCORD_ERROR_EXIT_THRESHOLD = 5;

setInterval(() => (recentPluginErrors = Math.max(0, recentPluginErrors - 1)), 2000);
setInterval(() => (recentDiscordErrors = Math.max(0, recentDiscordErrors - 1)), 2000);

// Eris handles these internally, so we don't need to panic if we get one of them
const SAFE_TO_IGNORE_ERIS_ERROR_CODES = [
  1001, // "CloudFlare WebSocket proxy restarting"
  1006, // "Connection reset by peer"
  "ECONNRESET", // Pretty much the same as above
];

const SAFE_TO_IGNORE_ERIS_ERROR_MESSAGES = ["Server didn't acknowledge previous heartbeat, possible lost connection"];

// Ignore plugin load errors during initial startup to avoid noise in the logs
let ignorePluginLoadErrors = true;

function errorHandler(err) {
  const guildId = err.guild?.id || err.guildId || "0";
  const guildName = err.guild?.name || (guildId && guildId !== "0" ? "Unknown" : "Global");

  if (err instanceof RecoverablePluginError) {
    // Recoverable plugin errors can be, well, recovered from.
    // Log it in the console as a warning and post a warning to the guild's log.

    // tslint:disable:no-console
    console.warn(`${guildId} ${guildName}: [${err.code}] ${err.message}`);

    if (err.guild) {
      const logs = new GuildLogs(err.guild.id);
      logs.log(LogType.BOT_ALERT, { body: `\`[${err.code}]\` ${err.message}` });
    }

    return;
  }

  if (err instanceof PluginLoadError) {
    if (!ignorePluginLoadErrors) {
      // tslint:disable:no-console
      console.warn(`${guildName} (${guildId}): Failed to load plugin '${err.pluginName}': ${err.message}`);
    }
    return;
  }

  if (err instanceof DiscordJSError) {
    if (err.code && SAFE_TO_IGNORE_ERIS_ERROR_CODES.includes(err.code)) {
      return;
    }

    if (err.message && SAFE_TO_IGNORE_ERIS_ERROR_MESSAGES.includes(err.message)) {
      return;
    }
  }

  if (isDiscordHTTPError(err) && err.code >= 500) {
    // Don't need stack traces on HTTP 500 errors
    // These also shouldn't count towards RECENT_DISCORD_ERROR_EXIT_THRESHOLD because they don't indicate an error in our code
    console.error(err.message);
    return;
  }

  if (err.message && err.message.startsWith("Request timed out")) {
    // These are very noisy, so just print the message without stack. The stack trace doesn't really help here anyway.
    console.error(err.message);
    return;
  }

  // FIXME: Hotfix
  if (err.message && err.message.startsWith("Unknown custom override criteria")) {
    // console.warn(err.message);
    return;
  }

  // FIXME: Hotfix
  if (err.message && err.message.startsWith("Unknown override criteria")) {
    // console.warn(err.message);
    return;
  }

  if (err instanceof PluginNotLoadedError) {
    // We don't want to crash the bot here, although this *should not happen*
    // TODO: Proper system for preventing plugin load/unload race conditions
    console.error(err);
    return;
  }

  if (err instanceof FishFishError) {
    // FishFish errors are not critical, so we just log them
    console.error(`[FISHFISH] ${err.message}`);
    return;
  }

  // tslint:disable:no-console
  console.error(err);

  if (err instanceof PluginError) {
    // Tolerate a few recent plugin errors before crashing
    if (++recentPluginErrors >= RECENT_PLUGIN_ERROR_EXIT_THRESHOLD) {
      console.error(`Exiting after ${RECENT_PLUGIN_ERROR_EXIT_THRESHOLD} plugin errors`);
      process.exit(1);
    }
  } else if (isDiscordAPIError(err) || isDiscordHTTPError(err)) {
    // Discord API errors, usually safe to just log instead of crash
    // We still bail if we get a ton of them in a short amount of time
    if (++recentDiscordErrors >= RECENT_DISCORD_ERROR_EXIT_THRESHOLD) {
      console.error(`Exiting after ${RECENT_DISCORD_ERROR_EXIT_THRESHOLD} API errors`);
      process.exit(1);
    }
  } else {
    // On other errors, crash immediately
    process.exit(1);
  }
  // tslint:enable:no-console
}

process.on("uncaughtException", errorHandler);
process.on("unhandledRejection", errorHandler);

// Verify required Node.js version
const REQUIRED_NODE_VERSION = "16.9.0";
const requiredParts = REQUIRED_NODE_VERSION.split(".").map((v) => parseInt(v, 10));
const actualVersionParts = process.versions.node.split(".").map((v) => parseInt(v, 10));
for (const [i, part] of actualVersionParts.entries()) {
  if (part > requiredParts[i]) break;
  if (part === requiredParts[i]) continue;
  throw new SimpleError(`Unsupported Node.js version! Must be at least ${REQUIRED_NODE_VERSION}`);
}

// Always use UTC internally
// This is also enforced for the database in data/db.ts
moment.tz.setDefault("UTC");

// Blocking check
let avgTotal = 0;
let avgCount = 0;
let lastCheck = performance.now();
setInterval(() => {
  const now = performance.now();
  let diff = Math.max(0, now - lastCheck);
  if (diff < 5) diff = 0;
  avgTotal += diff;
  avgCount++;
  lastCheck = now;
}, 500);
setInterval(
  () => {
    const avgBlocking = avgTotal / (avgCount || 1);
    // FIXME: Debug
    // tslint:disable-next-line:no-console
    console.log(`Average blocking in the last 5min: ${avgBlocking / avgTotal}ms`);
    avgTotal = 0;
    avgCount = 0;
  },
  5 * 60 * 1000,
);

if (env.DEBUG) {
  logger.info("NOTE: Bot started in DEBUG mode");
}

logger.info("Connecting to database");
connect().then(async () => {
  const client = new Client({
    partials: [Partials.User, Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction],

    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 1,
      // GuildMemberManager: 15000,
      GuildInviteManager: 0,
    }),

    rest: {
      // globalRequestsPerSecond: 50,
      // offset: 1000,
    },

    // Disable mentions by default
    allowedMentions: {
      parse: [],
      users: [],
      roles: [],
      repliedUser: false,
    },
    intents: [
      // Privileged
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      // GatewayIntentBits.GuildPresences,

      // Regular
      GatewayIntentBits.GuildMessageTyping,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildEmojisAndStickers,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  client.setMaxListeners(200);

  const safe429DecayInterval = 5 * SECONDS;
  const safe429MaxCount = 5;
  const safe429Counter = new DecayingCounter(safe429DecayInterval);
  client.on(Events.Debug, (errorText) => {
    if (!errorText.includes("429")) {
      return;
    }

    // tslint:disable-next-line:no-console
    console.warn(`[DEBUG] [WARN] [429] ${errorText}`);

    const value = safe429Counter.add(1);
    if (value > safe429MaxCount) {
      // tslint:disable-next-line:no-console
      console.error(`Too many 429s (over ${safe429MaxCount} in ${safe429MaxCount * safe429DecayInterval}ms), exiting`);
      process.exit(1);
    }
  });

  client.on("error", (err) => {
    if (err instanceof PluginLoadError) {
      errorHandler(err);
      return;
    }
    errorHandler(new DiscordJSError(err.message, (err as any).code, 0));
  });

  const allowedGuilds = new AllowedGuilds();
  const guildConfigs = new Configs();

  // Every guild must be explicitly authorized. Alert the OKG team, then immediately leave unauthorized guilds.
  client.on(Events.GuildCreate, async (guild) => {
    try {
      if (!(await allowedGuilds.isAllowed(guild.id))) {
        const alertChannelId = "1562875316936904704";
        const alertRoleId = "1562875592553009268";
        try {
          const alertChannel = await client.channels.fetch(alertChannelId);
          if (alertChannel?.isTextBased() && "send" in alertChannel) {
            const alertTextChannel = alertChannel as TextChannel;
            await alertTextChannel.send({
              content:
                `🚨 **OKG Manager unauthorized-server alert**\n` +
                `The bot was added to a server that is not authorized and is leaving now.\n\n` +
                `**Server:** ${guild.name}\n` +
                `**Server ID:** ${guild.id}\n` +
                `**Owner:** <@${guild.ownerId}> (${guild.ownerId})\n` +
                `**Members:** ${guild.memberCount ?? "unknown"}\n` +
                `<@&${alertRoleId}> please review this event.`,
              allowedMentions: { roles: [alertRoleId], users: [], parse: [] },
            });
          } else {
            logger.error(
              `Unauthorized guild ${guild.id}; alert channel ${alertChannelId} is unavailable or not text-based`,
            );
          }
        } catch (alertError) {
          logger.error(`Failed to alert the OKG team about unauthorized guild ${guild.id}: ${alertError}`);
        }

        try {
          await guild.leave();
          logger.warn(`Left unauthorized guild ${guild.id} (${guild.name})`);
        } catch (leaveError) {
          logger.error(`CRITICAL: failed to leave unauthorized guild ${guild.id}: ${leaveError}`);
        }
        return;
      }

      await allowedGuilds.updateInfo(guild.id, guild.name, guild.iconURL(), guild.ownerId);
      logger.info(`Synced dashboard metadata for allowed guild ${guild.id}`);
    } catch (error) {
      logger.warn(`Could not verify authorization or sync metadata for guild ${guild.id}: ${error}`);
      // Fail closed if authorization cannot be verified during a new guild join.
      try {
        if (!(await allowedGuilds.isAllowed(guild.id))) {
          await guild.leave();
          logger.warn(`Left guild ${guild.id} because authorization could not be verified`);
        }
      } catch (leaveError) {
        logger.error(`CRITICAL: could not enforce authorization for guild ${guild.id}: ${leaveError}`);
      }
    }
  });

  const bot = new Vety(client, {
    guildPlugins: availableGuildPlugins.map((obj) => obj.plugin),
    globalPlugins: availableGlobalPlugins.map((obj) => obj.plugin),

    options: {
      canLoadGuild(guildId): Promise<boolean> {
        return allowedGuilds.isAllowed(guildId);
      },

      /**
       * Plugins are enabled if they...
       * - are marked to be autoloaded, or
       * - are explicitly enabled in the guild config
       * Dependencies are also automatically loaded by Vety.
       */
      async getEnabledGuildPlugins(ctx, plugins): Promise<string[]> {
        if (!ctx.config || !ctx.config.plugins) {
          return [];
        }

        const configuredPlugins = ctx.config.plugins;
        const autoloadPluginNames = availableGuildPlugins.filter((obj) => obj.autoload).map((obj) => obj.plugin.name);

        return Array.from(plugins.keys()).filter((pluginName) => {
          if (autoloadPluginNames.includes(pluginName)) return true;
          return configuredPlugins[pluginName] && (configuredPlugins[pluginName] as any).enabled !== false;
        });
      },

      async getConfig(id) {
        const key = id === "global" ? "global" : `guild-${id}`;
        if (id !== "global") {
          const allowedGuild = await allowedGuilds.find(id);
          if (!allowedGuild) {
            return {};
          }
        }

        const row = await guildConfigs.getActiveByKey(key);
        if (row) {
          try {
            const loaded = loadYamlSafely(row.config);

            if (loaded.success_emoji || loaded.error_emoji) {
              const deprecatedKeys = [] as string[];
              // const exampleConfig = `plugins:\n  common:\n    config:\n      success_emoji: "👍"\n      error_emoji: "👎"`;

              if (loaded.success_emoji) {
                deprecatedKeys.push("success_emoji");
              }

              if (loaded.error_emoji) {
                deprecatedKeys.push("error_emoji");
              }

              // logger.warn(`Deprecated config properties found in "${key}": ${deprecatedKeys.join(", ")}`);
              // logger.warn(`You can now configure those emojis in the "common" plugin config\n${exampleConfig}`);
            }

            // Remove deprecated properties some may still have in their config
            delete loaded.success_emoji;
            delete loaded.error_emoji;

            return loaded;
          } catch (err) {
            logger.error(`Error while loading config "${key}": ${err}`);
            return {};
          }
        }

        logger.warn(`No config with key "${key}"`);
        return {};
      },

      logFn: (level, msg) => {
        if (level === "debug") return;

        if (logger[level]) {
          logger[level](msg);
        } else {
          logger.log(`[${level.toUpperCase()}] ${msg}`);
        }
      },

      performanceDebug: {
        enabled: false,
        size: 30,
        threshold: 200,
      },

      sendSuccessMessageFn(channel, body) {
        const guildId =
          channel instanceof TextChannel || channel instanceof ThreadChannel ? channel.guild.id : undefined;
        // @ts-expect-error
        const emoji = guildId ? bot.getLoadedGuild(guildId)!.config.success_emoji : undefined;
        channel.send(successMessage(body, emoji));
      },

      sendErrorMessageFn(channel, body) {
        const guildId =
          channel instanceof TextChannel || channel instanceof ThreadChannel ? channel.guild.id : undefined;
        // @ts-expect-error
        const emoji = guildId ? bot.getLoadedGuild(guildId)!.config.error_emoji : undefined;
        channel.send(errorMessage(body, emoji));
      },
    },
  });

  // Prefix commands are disabled during development; slash commands such as /announce stay active.
  // This listener only blocks message-prefix commands and does not intercept Discord interactions.
  // Never dispatch message-prefix commands; reply with the same notice for every configured prefix.
  const OKG_PREFIX_PAUSED_MESSAGE =
    "🚫 Sorry, prefixes are disabled, beacuse of development errors, the developers are actively working on trying to fix this, we are sorry. Join the support server ( https://discord.gg/2nHAng3gnr  ) if you need more help.";

  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || !message.content || message.author.bot || message.webhookId) return;

    // AI replies only when explicitly invoked; it is independent of the paused prefix-command system.
    void handleAIMessage(message).catch((error) => logger.error(`[OKG AI] Message handler failed: ${error}`));

    const trimmedContent = message.content.trimStart();
    // Vety exposes the default command prefix as a RegExp, not a string.
    const defaultPrefixPattern = getDefaultMessageCommandPrefix(client);
    const prefixes = new Set<string>([
      "!o", // Legacy OKG prefix; keep blocked even if the guild's configured prefix changed.
    ]);

    // Guild config allows one custom prefix string. Include it alongside the default prefix.
    try {
      const configRow = await guildConfigs.getActiveByKey(`guild-${message.guild.id}`);
      if (configRow) {
        const config = loadYamlSafely(configRow.config);
        if (typeof config.prefix === "string" && config.prefix.length > 0) {
          prefixes.add(config.prefix);
        }
      }
    } catch (error) {
      logger.warn(
        `Could not load prefix config for guild ${message.guild.id}; default and legacy prefixes remain blocked: ${error}`,
      );
    }

    // Reset lastIndex in case the library supplies a stateful RegExp.
    defaultPrefixPattern.lastIndex = 0;
    const matchesDefaultPrefix = defaultPrefixPattern.test(trimmedContent);
    const matchesConfiguredPrefix = Array.from(prefixes).some((prefix) => {
      if (!prefix || !trimmedContent.startsWith(prefix)) return false;
      const commandText = trimmedContent.slice(prefix.length);
      return commandText.length === 0 || !/\s/.test(commandText.charAt(0)) || commandText.trim().length === 0;
    });
    const isPrefixCommand = matchesDefaultPrefix || matchesConfiguredPrefix;

    if (!isPrefixCommand) return;

    await message.reply({ content: OKG_PREFIX_PAUSED_MESSAGE });
  });

  client.once("clientReady", async () => {
    // Refresh the names, icons, and owner IDs of already-allowed servers on every startup.
    for (const guild of client.guilds.cache.values()) {
      try {
        if (await allowedGuilds.isAllowed(guild.id)) {
          await allowedGuilds.updateInfo(guild.id, guild.name, guild.iconURL(), guild.ownerId);
        }
      } catch (error) {
        logger.warn(`Could not refresh dashboard metadata for guild ${guild.id}: ${error}`);
      }
    }

    startUptimeCounter();

    // Keep the deployed bot version visible in Discord's activity status.
    client.user?.setPresence({
      activities: [{ name: `Version ${BOT_VERSION} of OKG Administrative BotOS`, type: ActivityType.Playing }],
      status: "online",
    });

    // Register /announce before cleanup work so a cleanup failure cannot prevent it being submitted to Discord.
    try {
      const globalCommands = await client.application!.commands.fetch();
      const existingAnnounce = globalCommands.find((registered) => registered.name === "announce");
      if (existingAnnounce) await client.application!.commands.edit(existingAnnounce.id, announceCommand.toJSON());
      else await client.application!.commands.create(announceCommand.toJSON());
      logger.info("Registered /announce globally");
    } catch (error) {
      logger.error(`Failed to register /announce globally: ${error}`);
    }

    // Announce this release to per-server update channels configured with /updates-setup.
    // The channel topic stores the optional ping role, so settings survive bot restarts.
    for (const guild of client.guilds.cache.values()) {
      try {
        const channels = await guild.channels.fetch();
        const updateChannel = channels.find(
          (channel): channel is TextChannel =>
            channel instanceof TextChannel && channel.topic?.startsWith("okg-updates|role=") === true,
        );
        if (!updateChannel) continue;
        const recent = await updateChannel.messages.fetch({ limit: 100 });
        const releaseTitle = `## OKG Administrative BotOS — Version ${BOT_VERSION}`;
        if (recent.some((message) => message.author.id === client.user!.id && message.content.includes(releaseTitle))) {
          continue;
        }
        await postGuildUpdate(updateChannel, BOT_VERSION);
        logger.info(`Posted version ${BOT_VERSION} update in guild ${guild.id}`);
      } catch (error) {
        logger.warn(`Could not post bot update for guild ${guild.id}: ${error}`);
      }
    }

    // Announce each deployed version once to the maintainer release channel. Checking recent bot messages prevents
    // duplicate announcements on ordinary restarts.
    try {
      const releaseChannel = await client.channels.fetch("1562496808838631556");
      if (!releaseChannel || !releaseChannel.isTextBased() || !("messages" in releaseChannel)) {
        logger.warn("Release announcement channel 1562496808838631556 is unavailable or not text-based");
      } else {
        // Discord's channel fetch union includes partial/DM channel types. This ID
        // is our configured server announcement channel, so use its text-channel API.
        const announcementChannel = releaseChannel as TextChannel;
        const recentMessages = await announcementChannel.messages.fetch({ limit: 100 });
        const alreadyAnnounced = recentMessages.some(
          (message) => message.author.id === client.user!.id && message.content.includes(`## Version ${BOT_VERSION}`),
        );

        if (!alreadyAnnounced) {
          const updatedTimestamp = Math.floor(Date.now() / 1000);
          await announcementChannel.send({
            content: `<@&1562533677664305183>

## Version ${BOT_VERSION}

- Finalized the existing moderation commands under exactly one name per tier: /mod-* for moderator+, /manage-* for management, and /admin-* for admin-only actions.
- Removed obsolete moderation aliases and deleted guild-scoped slash-command copies so commands are no longer duplicated.
- Upgraded native OKG Support with private tickets, staff claim/unclaim, close/reopen/delete controls, per-user open-ticket limits, and configurable panel/welcome text.
- Added a required ticket intake form for a subject and detailed issue description before creating a ticket.
- Expanded ticket transcripts to paginate through up to 5,000 messages and include author IDs, attachment URLs, and embed summaries.
- Added OKG Manager Features → Support settings and the /support-panel command to publish the configured ticket panel.
- Added /updates-setup to create a per-server bot update channel and /updates-config to set or disable its release ping role.
- Applied the requested tiers: management for addcase, ban, kick, note, unban, unhidecase, and update; admin for deletecase, forceban, forcemute, forceunmute, massban, massmute, and massunban; moderator+ for case, cases, hidecase, mute, unmute, warn, and permission-level.
- Updated slash-command permission errors to show each command's actual new name.
- Restricted \x60/permission-level\x60 to members granted moderator case-view permission (or *).
- Kept \x60/announce\x60 under its existing announcement permission check.
- Disabled every configured/default message prefix (including legacy !o); prefix attempts receive the development-error notice instead of executing commands.
- Kept automatic version announcements with duplicate prevention and support for Discord Announcement channels.
- Set the bot's Playing presence to “Version ${BOT_VERSION} of OKG Administrative BotOS”.

Updated <t:${updatedTimestamp}:F>, by Coolkid5701`,
            allowedMentions: { parse: [], users: [], roles: ["1562533677664305183"], repliedUser: false },
          });
          logger.info(`Posted release announcement for version ${BOT_VERSION}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to post release announcement for version ${BOT_VERSION}: ${error}`);
    }

    try {
      // Remove obsolete moderation command names left behind by Discord's additive
      const obsoleteModerationCommandNames = new Set([
        "addcase",
        "ban",
        "kick",
        "note",
        "unban",
        "unhidecase",
        "update",
        "deletecase",
        "forceban",
        "forcemute",
        "forceunmute",
        "massban",
        "massmute",
        "massunban",
        "case",
        "cases",
        "hidecase",
        "mute",
        "unmute",
        "warn",
        "permission-level",
        "mod-addcase",
        "mod-ban",
        "mod-kick",
        "mod-note",
        "mod-unban",
        "mod-unhidecase",
        "mod-update",
        "mod-deletecase",
        "mod-forceban",
        "mod-forcemute",
        "mod-forceunmute",
        "mod-massban",
        "mod-massmute",
        "mod-massunban",
      ]);

      const commandsToRegister = [
        announceCommand,
        permissionLevelCommand,
        supportPanelCommand,
        updatesSetupCommand,
        updatesConfigCommand,
        aiSetupCommand,
        aiConfigCommand,
        aiAdminCommand,
        aiStatusCommand,
      ];

      // Remove obsolete global moderation aliases.
      const globalCommands = await client.application!.commands.fetch();
      for (const registered of globalCommands.values()) {
        if (obsoleteModerationCommandNames.has(registered.name)) {
          await client.application!.commands.delete(registered.id);
          logger.info(`Removed obsolete global slash command /${registered.name}`);
        }
      }

      // This bot uses global slash commands only. Remove every old guild-scoped
      // copy, including canonical names, so Discord does not display duplicates.
      for (const guild of client.guilds.cache.values()) {
        const guildCommands = await client.application!.commands.fetch({ guildId: guild.id });
        for (const registered of guildCommands.values()) {
          await client.application!.commands.delete(registered.id, guild.id);
          logger.info(`Removed duplicate guild-scoped slash command /${registered.name} from guild ${guild.id}`);
        }
      }

      // Register custom commands globally once; never create guild-scoped copies.
      for (const command of commandsToRegister) {
        const currentGlobalCommands = await client.application!.commands.fetch();
        const existingGlobal = currentGlobalCommands.find((registered) => registered.name === command.name);
        if (existingGlobal) {
          await client.application!.commands.edit(existingGlobal.id, command.toJSON());
        } else {
          await client.application!.commands.create(command.toJSON());
        }
      }

      logger.info(
        "Registered OKG moderation, support, update, and AI slash commands globally (single copy each); message prefixes remain paused",
      );
    } catch (error) {
      logger.error(`Failed to register slash commands: ${error}`);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isModalSubmit() && interaction.customId === "okg_support:create_modal") {
      if (!interaction.guildId) return;
      const configRow = await guildConfigs.getActiveByKey(`guild-${interaction.guildId}`);
      let config: unknown = {};
      if (configRow) {
        try {
          config = loadYamlSafely(configRow.config);
        } catch (error) {
          logger.error(`Failed to load guild config for support ticket form: ${error}`);
        }
      }
      await handleSupportModal(interaction, config);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("okg_support:")) {
      if (!interaction.guildId) return;
      const configRow = await guildConfigs.getActiveByKey(`guild-${interaction.guildId}`);
      let config: unknown = {};
      if (configRow) {
        try {
          config = loadYamlSafely(configRow.config);
        } catch (error) {
          logger.error(`Failed to load guild config for support ticket interaction: ${error}`);
        }
      }
      await handleSupportInteraction(interaction, config);
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.commandName === "support-panel") {
      const configRow = await guildConfigs.getActiveByKey(`guild-${interaction.guildId}`);
      let config: unknown = {};
      if (configRow) {
        try {
          config = loadYamlSafely(configRow.config);
        } catch (error) {
          logger.error(`Failed to load guild config for /support-panel: ${error}`);
        }
      }
      await handleSupportPanelCommand(interaction, config);
      return;
    }

    if (interaction.commandName === "updates-setup") {
      await handleUpdatesSetup(interaction);
      return;
    }

    if (interaction.commandName === "updates-config") {
      await handleUpdatesConfig(interaction);
      return;
    }

    if (["ai-setup", "ai-config", "ai-admin", "ai-status"].includes(interaction.commandName)) {
      await handleAICommand(interaction);
      return;
    }

    if (interaction.commandName === "announce") {
      await handleAnnounceCommand(interaction);
      return;
    }

    if (interaction.commandName === "mod-permission-level") {
      const configRow = await guildConfigs.getActiveByKey(`guild-${interaction.guildId}`);
      let config: unknown = {};
      if (configRow) {
        try {
          config = loadYamlSafely(configRow.config);
        } catch (error) {
          logger.error(`Failed to load guild config for /permission-level: ${error}`);
        }
      }
      await handlePermissionLevelCommand(interaction, config);
    }
  });

  client.rest.on(RESTEvents.RateLimited, (data) => {
    logRateLimit(data);
  });

  bot.on("error", errorHandler);

  bot.on("loadingFinished", async () => {
    setProfiler(bot.profiler);
    if (process.env.PROFILING === "true") {
      enableProfiling();
    }

    ignorePluginLoadErrors = false;

    initFishFish();

    runExpiringMutesLoop();
    await sleep(10 * SECONDS);
    runExpiringTempbansLoop();
    await sleep(10 * SECONDS);
    runUpcomingScheduledPostsLoop();
    await sleep(10 * SECONDS);
    runUpcomingRemindersLoop();
    await sleep(10 * SECONDS);
    runExpiringVCAlertsLoop();
    await sleep(10 * SECONDS);
    runExpiredArchiveDeletionLoop();
    await sleep(10 * SECONDS);
    runSavedMessageCleanupLoop();
    await sleep(10 * SECONDS);
    runExpiredMemberCacheDeletionLoop();
    await sleep(10 * SECONDS);
    runMemberCacheDeletionLoop();
  });

  let lowestGlobalRemaining = Infinity;
  setInterval(() => {
    lowestGlobalRemaining = Math.min(lowestGlobalRemaining, (client as any).rest.globalRemaining);
  }, 100);
  setInterval(() => {
    // FIXME: Debug
    if (lowestGlobalRemaining < 30) {
      // tslint:disable-next-line:no-console
      console.log("[DEBUG] Lowest global remaining in the past 15 seconds:", lowestGlobalRemaining);
    }
    lowestGlobalRemaining = Infinity;
  }, 15000);

  setInterval(() => {
    const queryStatsMap = consumeQueryStats();
    const entries = Array.from(queryStatsMap.entries());
    entries.sort((a, b) => b[1] - a[1]);
    const topEntriesStr = entries
      .slice(0, 5)
      .map(([key, count]) => `${count}x ${key}`)
      .join("\n");
    // FIXME: Debug
    // tslint:disable-next-line:no-console
    console.log(`Top query entries in the past 5 minutes:\n${topEntriesStr}`);
  }, 5 * MINUTES);

  bot.initialize();
  logger.info("Bot Initialized");
  logger.info("Logging in...");
  await client.login(env.BOT_TOKEN);

  // Don't intercept any signals in DEBUG mode: https://github.com/clinicjs/node-clinic/issues/444#issuecomment-1474997090
  if (!env.DEBUG) {
    let stopping = false;
    const cleanupAndStop = async (code) => {
      if (stopping) {
        return;
      }
      stopping = true;
      logger.info("Cleaning up before exit...");
      // Force exit after 10sec
      setTimeout(() => process.exit(code), 10 * SECONDS);
      await bot.destroy();
      await dataSource.destroy();
      logger.info("Done! Exiting now.");
      process.exit(code);
    };
    process.on("beforeExit", () => cleanupAndStop(0));
    process.on("SIGINT", () => {
      logger.info("Received SIGINT, exiting...");
      cleanupAndStop(0);
    });
    process.on("SIGTERM", () => {
      logger.info("Received SIGTERM, exiting...");
      cleanupAndStop(0);
    });
  }
});

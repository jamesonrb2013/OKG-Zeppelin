import {
  ChannelType,
  Client,
  PermissionFlagsBits,
  PermissionsBitField,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { AllowedGuilds } from "./data/AllowedGuilds.js";
import { redis } from "./data/redis.js";
import { logger } from "./logger.js";
import { BOT_VERSION } from "./version.js";

const QUEUE_KEY = "okg:developer:commands:queue";
const RESULT_PREFIX = "okg:developer:commands:result:";
const ALLOWED_ROLE_PERMISSIONS = [
  "Administrator",
  "ManageGuild",
  "ManageRoles",
  "ManageChannels",
  "ManageMessages",
  "ModerateMembers",
  "KickMembers",
  "BanMembers",
  "ViewAuditLog",
  "ManageWebhooks",
  "ManageNicknames",
  "ManageThreads",
  "ManageEvents",
] as const;

type DeveloperCommand =
  | { id: string; type: "servers.list" }
  | { id: string; type: "bot.stats" }
  | { id: string; type: "server.info"; guildId: string }
  | { id: string; type: "server.adminroles"; guildId: string }
  | { id: string; type: "server.channels"; guildId: string }
  | { id: string; type: "channel.create"; guildId: string; channelType: "text" | "voice" | "category"; name: string }
  | { id: string; type: "channel.delete"; guildId: string; channelId: string; confirmed: true }
  | { id: string; type: "channel.rename"; guildId: string; channelId: string; name: string }
  | { id: string; type: "user.inspect"; guildId: string; userId: string }
  | { id: string; type: "message.send"; guildId: string; channelId: string; message: string }
  | { id: string; type: "role.create"; guildId: string; name: string; give: string[]; position?: number; permissions: string[] }
  | { id: string; type: "role.assign" | "role.remove"; guildId: string; roleId: string; userId: string }
  | { id: string; type: "role.edit"; guildId: string; roleId: string; name?: string; permissions?: string[] }
  | { id: string; type: "role.delete"; guildId: string; roleId: string; confirmed: true };

type CommandResult = { ok: boolean; output: string };

const snowflake = (value: string) => /^\d{17,20}$/.test(value);

function safeText(value: string, max = 1800) {
  return value.replace(/@everyone|@here/g, "\u200b$&").slice(0, max);
}

async function getAllowedGuild(client: Client, allowedGuilds: AllowedGuilds, guildId: string) {
  if (!snowflake(guildId)) throw new Error("That server ID is invalid.");
  if (!(await allowedGuilds.isAllowed(guildId))) throw new Error("That server is not on OKG's authorized server list.");
  const guild = await client.guilds.fetch(guildId);
  if (!guild) throw new Error("The bot could not find that server.");
  return guild;
}

async function execute(client: Client, allowedGuilds: AllowedGuilds, command: DeveloperCommand): Promise<CommandResult> {
  if (command.type === "servers.list") {
    const rows = await Promise.all(Array.from(client.guilds.cache.values()).map(async (guild) => ({
      guild,
      allowed: await allowedGuilds.isAllowed(guild.id).catch(() => false),
    })));
    const allowed = rows.filter((row) => row.allowed).map(({ guild }) => `• ${guild.name} — ${guild.id}`);
    return { ok: true, output: allowed.length ? `Authorized servers (${allowed.length}):\n${allowed.join("\n")}` : "No authorized servers are currently cached." };
  }
  if (command.type === "bot.stats") {
    const memory = process.memoryUsage();
    const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + " MB";
    return {
      ok: true,
      output: [
        "OKG Manager Bot Statistics",
        "Version: " + BOT_VERSION,
        "WebSocket latency: " + Math.round(client.ws.ping) + " ms",
        "Connected servers: " + client.guilds.cache.size,
        "Cached users: " + client.users.cache.size,
        "Process uptime: " + Math.floor(process.uptime()) + " seconds",
        "RSS memory: " + mb(memory.rss),
        "Heap used: " + mb(memory.heapUsed),
        "Heap total: " + mb(memory.heapTotal),
      ].join("\n"),
    };
  }

  const guild = await getAllowedGuild(client, allowedGuilds, command.guildId);

  if (command.type === "server.info") {
    const owner = await guild.fetchOwner().catch(() => null);
    const me = guild.members.me ?? await guild.members.fetchMe();
    return {
      ok: true,
      output: [
        `Server: ${guild.name}`,
        `ID: ${guild.id}`,
        `Owner: ${owner?.user.tag ?? "Unavailable"} (${guild.ownerId})`,
        `Members: ${guild.memberCount}`,
        `Channels: ${guild.channels.cache.size}`,
        `Roles: ${guild.roles.cache.size}`,
        `Created: ${guild.createdAt.toISOString()}`,
        `Bot highest role: ${me.roles.highest.name} (position ${me.roles.highest.position})`,
      ].join("\n"),
    };
  }

  if (command.type === "server.adminroles") {
    const roles = await guild.roles.fetch();
    const botMember = guild.members.me ?? await guild.members.fetchMe();
    const adminRoles = roles.filter((role) =>
      role.permissions.any([
        PermissionFlagsBits.Administrator,
        PermissionFlagsBits.ManageGuild,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.ManageMessages,
      ]),
    ).sort((a, b) => b.position - a.position);

    // Count role assignments from Discord's complete, paginated member list.
    // The gateway cache may not contain every server member.
    const memberCounts = new Map<string, number>(adminRoles.map((role) => [role.id, 0]));
    let after = "0";
    while (true) {
      const response = await fetch(`https://discord.com/api/v10/guilds/${guild.id}/members?limit=1000&after=${after}`, {
        headers: { Authorization: `Bot ${client.token}`, "User-Agent": "OKG-Manager/AdminRoles" },
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Could not count role members (Discord ${response.status}): ${body.slice(0, 180)}`);
      }
      const members = await response.json() as Array<{ user: { id: string }; roles: string[] }>;
      if (members.length === 0) break;
      for (const member of members) {
        for (const roleId of member.roles) {
          if (memberCounts.has(roleId)) memberCounts.set(roleId, (memberCounts.get(roleId) ?? 0) + 1);
        }
      }
      after = members[members.length - 1].user.id;
      if (members.length < 1000) break;
    }

    const highest = botMember.roles.highest;
    const lines = adminRoles.map((role, index) => {
      const flags = role.permissions.toArray();
      const warning = flags.includes("Administrator") ? "  ⚠ ADMINISTRATOR" : "";
      return [
        `${index + 1}. ${role.name}${warning}`,
        `   Members: ${(memberCounts.get(role.id) ?? 0).toLocaleString()}  •  Position: ${role.position}`,
        `   Permissions: ${flags.join(", ") || "None"}`,
        `   Role ID: ${role.id}`,
      ].join("\n");
    });
    return {
      ok: true,
      output: [
        `ADMINISTRATIVE ROLES  /  ${guild.name}`,
        `Found ${adminRoles.size} role${adminRoles.size === 1 ? "" : "s"} with elevated permissions`,
        "",
        `BOT HIGHEST ROLE  /  ${highest.name}`,
        `Position: ${highest.position}  •  Role ID: ${highest.id}`,
        "",
        adminRoles.size ? lines.join("\n\n") : "No roles with administrative permissions were found.",
        "",
        "Member counts are based on Discord's complete server-member list.",
      ].join("\n"),
    };
  }

  if (command.type === "server.channels") {
    const channels = await guild.channels.fetch();
    const rows = channels
      .filter((channel) => channel !== null)
      .sort((a, b) => ((a as any).rawPosition ?? 0) - ((b as any).rawPosition ?? 0))
      .map((channel) => {
      const kind = channel.type === 0 ? "text" : channel.type === 2 ? "voice" : channel.type === 4 ? "category" : channel.type === 5 ? "announcement" : channel.type === 13 ? "stage" : channel.type === 15 ? "forum" : channel.type === 16 ? "media" : "other";
      return `• #${channel.name} [${kind}] — ${channel.id}`;
    });
    return { ok: true, output: rows.length ? `Channels in ${guild.name} (${rows.length}):\n${rows.join("\n")}` : `No channels found in ${guild.name}.` };
  }

  if (command.type === "channel.create") {
    const name = command.name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").slice(0, 100);
    if (!name) throw new Error("Channel name cannot be empty.");
    const botMember = guild.members.me ?? await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error("The bot needs Manage Channels permission in that server.");
    const type = command.channelType === "text" ? ChannelType.GuildText : command.channelType === "voice" ? ChannelType.GuildVoice : ChannelType.GuildCategory;
    const channel = await guild.channels.create({ name, type, reason: "Created through the OKG Manager owner Developer Center" });
    return { ok: true, output: "Created " + command.channelType + " channel #" + channel.name + " in " + guild.name + ".\nChannel ID: " + channel.id };
  }

  if (command.type === "channel.rename") {
    if (!snowflake(command.channelId)) throw new Error("That channel ID is invalid.");
    const name = command.name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").slice(0, 100);
    if (!name) throw new Error("Channel name cannot be empty.");
    const botMember = guild.members.me ?? await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error("The bot needs Manage Channels permission in that server.");
    const channel = await guild.channels.fetch(command.channelId);
    if (!channel || channel.guildId !== guild.id) throw new Error("That channel was not found in the selected server.");
    if (!channel.manageable) throw new Error("The bot cannot manage that channel.");
    await channel.setName(name);
    return { ok: true, output: "Renamed channel " + command.channelId + " to #" + name + " in " + guild.name + "." };
  }

  if (command.type === "channel.delete") {
    if (!snowflake(command.channelId)) throw new Error("That channel ID is invalid.");
    if (command.confirmed !== true) throw new Error("Channel deletion requires the explicit --confirm flag.");
    const botMember = guild.members.me ?? await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error("The bot needs Manage Channels permission in that server.");
    const channel = await guild.channels.fetch(command.channelId);
    if (!channel || channel.guildId !== guild.id) throw new Error("That channel was not found in the selected server.");
    if (!channel.manageable) throw new Error("The bot cannot manage that channel.");
    const channelName = channel.name;
    await channel.delete();
    return { ok: true, output: "Deleted channel #" + channelName + " (" + command.channelId + ") from " + guild.name + "." };
  }
  if (command.type === "user.inspect") {
    if (!snowflake(command.userId)) throw new Error("That user ID is invalid.");
    const member = await guild.members.fetch(command.userId);
    return {
      ok: true,
      output: [
        `User: ${member.user.tag}`,
        `ID: ${member.id}`,
        `Nickname: ${member.nickname ?? "None"}`,
        `Joined: ${member.joinedAt?.toISOString() ?? "Unknown"}`,
        `Account created: ${member.user.createdAt.toISOString()}`,
        `Timed out: ${member.communicationDisabledUntil?.toISOString() ?? "No"}`,
        `Roles: ${member.roles.cache.filter((role) => role.id !== guild.id).map((role) => role.name).join(", ") || "None"}`,
        `Key permissions: ${member.permissions.toArray().join(", ") || "None"}`,
      ].join("\n"),
    };
  }

  if (command.type === "message.send") {
    if (!snowflake(command.channelId)) throw new Error("That channel ID is invalid.");
    const channel = await guild.channels.fetch(command.channelId);
    if (!channel || !channel.isTextBased() || !("send" in channel)) throw new Error("That channel is not a message-capable text channel.");
    if (channel.guildId !== guild.id) throw new Error("The channel does not belong to the selected server.");
    const botMember = guild.members.me ?? await guild.members.fetchMe();
    const permissions = channel.permissionsFor(botMember);
    if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
      throw new Error("The bot is missing View Channel or Send Messages permission there.");
    }
    const content = safeText(command.message, 2000);
    if (!content.trim()) throw new Error("Message cannot be empty.");
    const sent = await (channel as TextChannel | ThreadChannel).send({
      content,
      allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
    });
    return { ok: true, output: `Message sent successfully.\nServer: ${guild.name}\nChannel ID: ${command.channelId}\nMessage ID: ${sent.id}` };
  }

  if (command.type === "role.create") {
    const name = command.name.trim().slice(0, 100);
    if (!name) throw new Error("Role name cannot be empty.");
    const botMember = guild.members.me ?? await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error("The bot needs Manage Roles permission in that server.");
    const highestBotPosition = botMember.roles.highest.position;
    if (command.position !== undefined && (!Number.isInteger(command.position) || command.position < 1 || command.position >= highestBotPosition)) {
      throw new Error(`Position must be between 1 and ${Math.max(1, highestBotPosition - 1)} (below the bot's highest role).`);
    }
    const permissionNames = command.permissions;
    const invalidPermissions = permissionNames.filter((permission) => !ALLOWED_ROLE_PERMISSIONS.includes(permission as any));
    if (invalidPermissions.length) throw new Error(`Unsupported permission names: ${invalidPermissions.join(", ")}.`);
    const permissions = permissionNames.map((permission) => {
      const flag = (PermissionFlagsBits as any)[permission];
      if (flag === undefined) throw new Error(`Unknown Discord permission: ${permission}`);
      return flag;
    });
    const role = await guild.roles.create({
      name,
      permissions: new PermissionsBitField(permissions),
      reason: "Created through the OKG Manager owner Developer Center",
    });
    if (command.position !== undefined) await role.setPosition(command.position);
    const assigned: string[] = [];
    const skipped: string[] = [];
    for (const userId of command.give) {
      if (!snowflake(userId)) { skipped.push(`${userId}: invalid user ID`); continue; }
      try {
        const member = await guild.members.fetch(userId);
        if (!member.manageable) { skipped.push(`${userId}: member is above the bot or cannot be managed`); continue; }
        await member.roles.add(role, "Assigned through the OKG Manager owner Developer Center");
        assigned.push(member.user.tag);
      } catch (error: any) {
        skipped.push(`${userId}: ${String(error?.message || "assignment failed").slice(0, 100)}`);
      }
    }
    return {
      ok: true,
      output: [
        `Created role ${role.name} in ${guild.name}.`,
        `Role ID: ${role.id}`,
        `Permissions: ${permissionNames.join(", ") || "No elevated permissions"}`,
        `Assigned to: ${assigned.join(", ") || "No users"}`,
        skipped.length ? `Skipped: ${skipped.join("; ")}` : "",
      ].filter(Boolean).join("\n"),
    };
  }

  if (command.type === "role.assign" || command.type === "role.remove" || command.type === "role.delete" || command.type === "role.edit") {
    if (!snowflake(command.roleId)) throw new Error("That role ID is invalid.");
    const botMember = guild.members.me ?? await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error("The bot needs Manage Roles permission in that server.");
    const role = await guild.roles.fetch(command.roleId);
    if (!role || role.guild.id !== guild.id) throw new Error("That role was not found in the selected server.");
    if (role.id === guild.id || role.managed || role.position >= botMember.roles.highest.position || !role.editable) {
      throw new Error("That role is managed, is the @everyone role, or is at/above the bot highest role and cannot be changed.");
    }
    if (command.type === "role.delete") {
      if (command.confirmed !== true) throw new Error("Role deletion requires the explicit --confirm flag.");
      const roleName = role.name;
      await role.delete();
      return { ok: true, output: `Deleted role ${roleName} (${command.roleId}) from ${guild.name}.` };
    }
    if (command.type === "role.edit") {
      if (command.name === undefined && command.permissions === undefined) throw new Error("Provide --name and/or --permissions.");
      const changes: { name?: string; permissions?: PermissionsBitField } = {};
      if (command.name !== undefined) {
        const name = command.name.trim().slice(0, 100);
        if (!name) throw new Error("Role name cannot be empty.");
        changes.name = name;
      }
      if (command.permissions !== undefined) {
        const invalid = command.permissions.filter((permission) => !ALLOWED_ROLE_PERMISSIONS.includes(permission as any));
        if (invalid.length) throw new Error("Unsupported permission names: " + invalid.join(", ") + ".");
        const flags = command.permissions.map((permission) => (PermissionFlagsBits as any)[permission]);
        if (flags.some((flag) => flag === undefined)) throw new Error("One or more Discord permissions are invalid.");
        changes.permissions = new PermissionsBitField(flags);
      }
      await role.edit({ ...changes, reason: "Edited through the OKG Manager owner Developer Center" });
      return { ok: true, output: "Updated role " + role.name + " (" + role.id + ") in " + guild.name + "." };
    }
    if (!snowflake(command.userId)) throw new Error("That user ID is invalid.");
    const member = await guild.members.fetch(command.userId);
    if (!member.manageable) throw new Error("That member is above the bot or cannot be managed.");
    if (command.type === "role.assign") {
      if (member.roles.cache.has(role.id)) return { ok: true, output: `${member.user.tag} already has ${role.name}.` };
      await member.roles.add(role, "Assigned through the OKG Manager owner Developer Center");
      return { ok: true, output: `Assigned ${role.name} (${role.id}) to ${member.user.tag} in ${guild.name}.` };
    }
    if (!member.roles.cache.has(role.id)) return { ok: true, output: `${member.user.tag} does not have ${role.name}.` };
    await member.roles.remove(role, "Removed through the OKG Manager owner Developer Center");
    return { ok: true, output: `Removed ${role.name} (${role.id}) from ${member.user.tag} in ${guild.name}.` };
  }

  throw new Error("Unsupported developer command.");
}

export function startDeveloperCommandWorker(client: Client, allowedGuilds: AllowedGuilds) {
  let running = false;
  const processQueue = async () => {
    if (running || !client.isReady()) return;
    running = true;
    try {
      // Process a bounded batch so command work never starves the Discord event loop.
      for (let index = 0; index < 5; index++) {
        const raw = await redis.lPop(QUEUE_KEY);
        if (!raw) break;
        let command: DeveloperCommand;
        try {
          command = JSON.parse(raw) as DeveloperCommand;
          if (!command || typeof command.id !== "string" || !/^[a-f0-9-]{36}$/i.test(command.id)) continue;
        } catch {
          logger.warn("Discarded malformed Developer Center command job.");
          continue;
        }
        let result: CommandResult;
        try {
          result = await execute(client, allowedGuilds, command);
        } catch (error: any) {
          result = { ok: false, output: String(error?.message || error).slice(0, 1500) };
          logger.warn(`Developer command ${command.type} failed: ${result.output}`);
        }
        await redis.set(`${RESULT_PREFIX}${command.id}`, JSON.stringify(result), { EX: 90 });
      }
    } catch (error) {
      logger.error(`Developer command worker error: ${error}`);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void processQueue(), 500);
  timer.unref?.();
  logger.info("Developer command worker started.");
}

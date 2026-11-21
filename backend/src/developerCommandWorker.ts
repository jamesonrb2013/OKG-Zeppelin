import {
  Client,
  PermissionFlagsBits,
  PermissionsBitField,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { AllowedGuilds } from "./data/AllowedGuilds.js";
import { redis } from "./data/redis.js";
import { logger } from "./logger.js";

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
  | { id: string; type: "server.info"; guildId: string }
  | { id: string; type: "server.adminroles"; guildId: string }
  | { id: string; type: "user.inspect"; guildId: string; userId: string }
  | { id: string; type: "message.send"; guildId: string; channelId: string; message: string }
  | { id: string; type: "role.create"; guildId: string; name: string; give: string[]; position?: number; permissions: string[] };

type CommandResult = { ok: boolean; output: string };

const snowflake = (value: string) => /^\d{17,20}$/.test(value);

function safeText(value: string, max = 1800) {
  return value.replace(/@everyone|@here/g, "\u200breturn value.replace(/@everyone|@here/g, "\u200bvalue.replace(/@everyone|@here/g, "@\u200b$&")").slice(0, max);").slice(0, max);
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
    return {
      ok: true,
      output: adminRoles.size
        ? `Administrative roles in ${guild.name} (${adminRoles.size}):\n${adminRoles.map((role) => `• ${role.name} — ${role.id} [${role.permissions.toArray().join(", ")}]`).join("\n")}`
        : `No roles with administrative permissions were found in ${guild.name}.`,
    };
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
    return { ok: true, output: `Message sent successfully.\nServer: ${guild.name}\nChannel: #${"name" in channel ? channel.name : channel.id} (${channel.id})\nMessage ID: ${sent.id}` };
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

import { ApiPermissions } from "@zeppelinbot/shared/apiPermissions.js";
import express, { Request, Response } from "express";
import { PermissionsBitField } from "discord.js";
import { AllowedGuilds } from "../../data/AllowedGuilds.js";
import { env } from "../../env.js";
import { rateLimit } from "../rateLimits.js";
import { requireGuildPermission } from "../permissions.js";
import { serverError, unauthorized } from "../responses.js";

type DiscordRole = {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  managed: boolean;
  mentionable: boolean;
  permissions: string;
  position: number;
  icon?: string | null;
  unicode_emoji?: string | null;
};

type RoleDetails = {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  managed: boolean;
  mentionable: boolean;
  position: number;
  icon: string | null;
  unicodeEmoji: string | null;
  createdAt: string;
  permissions: string[];
  memberCount: number;
};

type CachedRoleDetails = { expiresAt: number; roles: RoleDetails[] };
const cache = new Map<string, CachedRoleDetails>();
const CACHE_TTL_MS = 60_000;
const DISCORD_API = "https://discord.com/api/v10";

async function discordGet<T>(path: string): Promise<T> {
  const response = await fetch(DISCORD_API + path, {
    headers: { Authorization: `Bot ${env.BOT_TOKEN}`, "User-Agent": "OKG-Manager/RoleDetails" },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Discord API returned ${response.status}: ${body.slice(0, 240)}`);
  }
  return response.json() as Promise<T>;
}

function roleCreatedAt(roleId: string): string {
  const timestamp = Number((BigInt(roleId) >> 22n) + 1420070400000n);
  return new Date(timestamp).toISOString();
}

async function loadRoleDetails(guildId: string): Promise<RoleDetails[]> {
  const existing = cache.get(guildId);
  if (existing && existing.expiresAt > Date.now()) return existing.roles;

  const discordRoles = await discordGet<DiscordRole[]>(`/guilds/${guildId}/roles`);
  const counts = new Map<string, number>(discordRoles.map((role) => [role.id, 0]));

  // Discord exposes role assignments through paginated guild-member records.
  // Fetch every page so the displayed counts are exact, including in large servers.
  let after = "0";
  while (true) {
    const members = await discordGet<Array<{ user: { id: string }; roles: string[] }>>(
      `/guilds/${guildId}/members?limit=1000&after=${after}`,
    );
    if (members.length === 0) break;
    for (const member of members) {
      for (const roleId of member.roles) {
        counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
      }
    }
    after = members[members.length - 1].user.id;
    if (members.length < 1000) break;
  }

  const roles = discordRoles
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      managed: role.managed,
      mentionable: role.mentionable,
      position: role.position,
      icon: role.icon ?? null,
      unicodeEmoji: role.unicode_emoji ?? null,
      createdAt: roleCreatedAt(role.id),
      permissions: new PermissionsBitField(BigInt(role.permissions)).toArray(),
      memberCount: counts.get(role.id) ?? 0,
    }))
    .sort((a, b) => b.position - a.position);

  cache.set(guildId, { roles, expiresAt: Date.now() + CACHE_TTL_MS });
  return roles;
}

export function initGuildsRolesAPI(router: express.Router) {
  const allowedGuilds = new AllowedGuilds();
  router.get(
    "/:guildId/roles",
    requireGuildPermission(ApiPermissions.ViewGuild),
    rateLimit((req) => `role-details-${req.params.guildId}-${req.user!.userId}`, 15_000, "Please wait before refreshing role details again."),
    async (req: Request, res: Response) => {
      if (!(await allowedGuilds.isAllowed(req.params.guildId))) return unauthorized(res);
      try {
        const roles = await loadRoleDetails(req.params.guildId);
        res.setHeader("Cache-Control", "no-store");
        return res.json({ roles, cachedForSeconds: Math.floor(CACHE_TTL_MS / 1000) });
      } catch (error) {
        console.error("Unable to load role details:", error);
        return serverError(res, "Could not load role details from Discord. Check that the bot is in this server and has access to its members.");
      }
    },
  );
}

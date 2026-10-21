import { GuildMember, Snowflake } from "discord.js";
import { GuildPluginData } from "vety";
import { ModActionsPluginType } from "../types.js";

/**
 * Check only explicit role_permissions grants. An absent or empty map grants
 * no manual moderation permissions; numeric levels and legacy config defaults
 * must never grant moderation actions.
 */
async function hasModPermission(
  pluginData: GuildPluginData<ModActionsPluginType>,
  member: GuildMember,
  channelId: Snowflake,
  permission: string,
): Promise<boolean> {
  const rolePermissions = (pluginData.fullConfig as any)?.role_permissions as Record<string, string[]> | undefined;

  if (rolePermissions && Object.keys(rolePermissions).length > 0) {
    // Slash-command interaction members can have partial or stale role data.
    // Fetch the current GuildMember just as the command wrapper does.
    const currentMember = await pluginData.guild.members.fetch(member.id).catch(() => null);
    const roles = currentMember?.roles.cache ?? member.roles.cache;

    return roles.some((role) => {
      const grants = rolePermissions[role.id];
      return Array.isArray(grants) && (grants.includes("*") || grants.includes(permission));
    });
  }

  return false;
}

export function hasNotePermission(
  pluginData: GuildPluginData<ModActionsPluginType>,
  member: GuildMember,
  channelId: Snowflake,
) {
  return hasModPermission(pluginData, member, channelId, "can_note");
}

export function hasWarnPermission(
  pluginData: GuildPluginData<ModActionsPluginType>,
  member: GuildMember,
  channelId: Snowflake,
) {
  return hasModPermission(pluginData, member, channelId, "can_warn");
}

export function hasMutePermission(
  pluginData: GuildPluginData<ModActionsPluginType>,
  member: GuildMember,
  channelId: Snowflake,
) {
  return hasModPermission(pluginData, member, channelId, "can_mute");
}

export function hasBanPermission(
  pluginData: GuildPluginData<ModActionsPluginType>,
  member: GuildMember,
  channelId: Snowflake,
) {
  return hasModPermission(pluginData, member, channelId, "can_ban");
}

import { GuildMember, Snowflake } from "discord.js";
import { GuildPluginData } from "vety";
import { ModActionsPluginType } from "../types.js";

/**
 * Check the custom role_permissions map first, because command visibility in
 * Discord Integrations is only a visibility setting and does not grant the
 * bot-side permission needed by Zeppelin's moderation action handlers.
 *
 * If no custom role map is configured, retain Zeppelin's existing per-plugin
 * can_* config behavior for backwards compatibility.
 */
async function hasModPermission(
  pluginData: GuildPluginData<ModActionsPluginType>,
  member: GuildMember,
  channelId: Snowflake,
  permission: string,
): Promise<boolean> {
  const rolePermissions = (pluginData.fullConfig as any)?.role_permissions as
    | Record<string, string[]>
    | undefined;

  if (rolePermissions && Object.keys(rolePermissions).length > 0) {
    return member.roles.cache.some((role) => {
      const grants = rolePermissions[role.id];
      return Array.isArray(grants) && (grants.includes("*") || grants.includes(permission));
    });
  }

  const config = await pluginData.config.getMatchingConfig({ member, channelId });
  return Boolean((config as any)[permission]);
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

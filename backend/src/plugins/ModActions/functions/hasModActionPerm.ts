import { GuildMember, Snowflake } from "discord.js";
import { GuildPluginData } from "vety";
import { ModActionsPluginType } from "../types.js";

const PLATFORM_OWNER_ID = "1441223435043868735";

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
  if (member.id === PLATFORM_OWNER_ID) return true;

  const currentMember = await pluginData.guild.members.fetch(member.id).catch(() => member);
  const effectiveConfig = await pluginData.config.getMatchingConfig({ member: currentMember, channelId });
  return effectiveConfig[permission] === true;
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

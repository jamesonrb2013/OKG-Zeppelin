import { GuildPluginData } from "vety";
import { startProfiling } from "../../../utils/easyProfiler.js";
import { AutomodContext, AutomodPluginType } from "../types.js";

export function clearRecentActionsForMessage(pluginData: GuildPluginData<AutomodPluginType>, context: AutomodContext) {
  const stopProfiling = startProfiling(
    pluginData.getVetyInstance().profiler,
    "automod:fns:clearRecentActionsForMessage",
  );
  const message = context.message!;
  // An edit replaces only this message's contribution. Do not erase the
  // member's other recent messages, which are needed for accurate spam windows.
  pluginData.state.recentActions = pluginData.state.recentActions.filter((action) => {
    return action.context.message?.id !== message.id;
  });
  stopProfiling();
}

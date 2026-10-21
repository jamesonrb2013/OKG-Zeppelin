import { guildPlugin } from "vety";
import { SupportPluginType, zSupportConfig } from "./types.js";

export const SupportPlugin = guildPlugin<SupportPluginType>()({
  name: "support",
  configSchema: zSupportConfig,
});

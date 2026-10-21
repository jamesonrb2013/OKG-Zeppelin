import { ZeppelinPluginDocs } from "../../types.js";
import { zSupportConfig } from "./types.js";

export const supportPluginDocs: ZeppelinPluginDocs = {
  type: "stable",
  prettyName: "Support tickets",
  description:
    "A native OKG Manager support-ticket system with private tickets, claiming, closing, reopening, transcripts, and dashboard configuration.",
  configurationGuide:
    "Configure this plugin in the OKG Manager dashboard under Features → Support. After saving the configuration, run /support-panel in your server to post the public ticket panel.",
  configSchema: zSupportConfig,
};

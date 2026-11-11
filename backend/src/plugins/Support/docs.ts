import { ZeppelinPluginDocs } from "../../types.js";
import { zSupportConfig } from "./types.js";

export const supportPluginDocs: ZeppelinPluginDocs = {
  type: "stable",
  prettyName: "Support & Modmail",
  description:
    "A native OKG Manager support-ticket system and DM-based Modmail inbox with role-restricted staff replies, conversation closing, transcripts, and dashboard configuration.",
  configurationGuide:
    "Configure this plugin in the OKG Manager dashboard under Features → Support. For Modmail, enable it and set a staff-only inbox text channel plus the Modmail staff role. Grant the bot View Channel, Send Messages, Create Public Threads, Send Messages in Threads, and Read Message History. After saving ticket settings, run /support-panel in your server to post the public ticket panel.",
  configSchema: zSupportConfig,
};

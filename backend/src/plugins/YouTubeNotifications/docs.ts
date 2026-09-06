import { ZeppelinPluginDocs } from "../../types.js";
import { zYouTubeNotificationsConfig } from "./types.js";

export const youtubeNotificationsPluginDocs: ZeppelinPluginDocs = {
  prettyName: "YouTube Notifications",
  description:
    "Posts notifications when a configured YouTube channel publishes a new video.",
  type: "plugin",
  configSchema: zYouTubeNotificationsConfig,
};

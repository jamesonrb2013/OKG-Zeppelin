import { BasePluginType } from "vety";
import { z } from "zod";

export const zYouTubeNotificationsConfig = z.strictObject({
  enabled: z.boolean().default(false),

  channel_url: z
    .string()
    .url()
    .default("https://youtube.com/@bentleyboovr"),

  notification_channel: z
    .string()
    .default("1546275911278530570"),

  mention_everyone: z.boolean().default(true),

  check_interval: z
    .number()
    .int()
    .min(30)
    .default(300),
});

export interface YouTubeNotificationsPluginType extends BasePluginType {
  configSchema: typeof zYouTubeNotificationsConfig;

  state: {
    interval: NodeJS.Timeout | null;
    channelId: string | null;
    initialized: boolean;
    knownVideoIds: Set<string>;
  };
}

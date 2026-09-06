import { TextChannel } from "discord.js";
import { guildPlugin } from "vety";
import {
  YouTubeNotificationsPluginType,
  zYouTubeNotificationsConfig,
} from "./types.js";

interface YouTubeVideo {
  id: string;
  title: string;
  publishedAt: string;
}

async function getYouTubeVideos(channelUrl: string): Promise<YouTubeVideo[]> {
  const response = await fetch(channelUrl);

  if (!response.ok) {
    throw new Error(`YouTube request failed with ${response.status}`);
  }

  const html = await response.text();

  const videos: YouTubeVideo[] = [];
  const seen = new Set<string>();

  const regex =
    /"videoId":"([^"]+)".*?"title":\{"runs":\[\{"text":"([^"]+)"/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const id = match[1];
    const title = match[2];

    if (!seen.has(id)) {
      seen.add(id);

      videos.push({
        id,
        title,
        publishedAt: new Date().toISOString(),
      });
    }
  }

  return videos.slice(0, 10);
}

export const YouTubeNotificationsPlugin =
  guildPlugin<YouTubeNotificationsPluginType>()({
    name: "youtube_notifications",

    configSchema: zYouTubeNotificationsConfig,

    beforeLoad(pluginData) {
      pluginData.state.interval = null;
      pluginData.state.channelId = null;
      pluginData.state.initialized = false;
      pluginData.state.knownVideoIds = new Set();
    },

    async afterLoad(pluginData) {
  const { guild, state } = pluginData;
  const config = pluginData.config.get();

  if (!config.enabled) {
    return;
  }

  const channel = guild.channels.cache.get(
    config.notification_channel,
  );

      if (!(channel instanceof TextChannel)) {
        console.error(
          `[YouTubeNotifications] Channel ${config.notification_channel} is not a text channel`,
        );
        return;
      }

      const check = async () => {
        try {
          const videos = await getYouTubeVideos(config.channel_url);

          if (videos.length === 0) {
            return;
          }

          // First run only establishes the current videos.
          // This prevents old videos from being announced on startup.
          if (!state.initialized) {
            for (const video of videos) {
              state.knownVideoIds.add(video.id);
            }

            state.initialized = true;
            return;
          }

          const newVideos = videos.filter(
            (video) => !state.knownVideoIds.has(video.id),
          );

          for (const video of newVideos.reverse()) {
            const mention = config.mention_everyone
              ? "@everyone\n\n"
              : "";

            await channel.send(
              `${mention}🎬 **New BentleyBoovr video!**\n\n` +
                `**${video.title}**\n\n` +
                `🔗 https://www.youtube.com/watch?v=${video.id}`,
            );

            state.knownVideoIds.add(video.id);
          }

          // Keep the set from growing forever.
          if (state.knownVideoIds.size > 100) {
            const ids = Array.from(state.knownVideoIds).slice(-50);

            state.knownVideoIds = new Set(ids);
          }
        } catch (error) {
          console.error(
            "[YouTubeNotifications] Failed to check YouTube:",
            error,
          );
        }
      };

      await check();

      state.interval = setInterval(
        check,
        config.check_interval * 1000,
      );
    },

    beforeUnload(pluginData) {
      if (pluginData.state.interval) {
        clearInterval(pluginData.state.interval);
        pluginData.state.interval = null;
      }
    },
  });

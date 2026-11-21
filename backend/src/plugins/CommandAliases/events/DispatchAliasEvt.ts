import { createForwardedPrefixMessage, INTERNAL_COMMAND_PREFIX } from "../../../prefix/PrefixCommandDispatcher.js";
import { commandAliasesEvt } from "../types.js";

export const DispatchAliasEvt = commandAliasesEvt({
  event: "messageCreate",
  async listener({ args: { message: msg }, pluginData }) {
    if (!msg.guild || !msg.content) return;
    if (msg.author.bot || msg.webhookId) return;

    // This event handles configurable aliases only. The special !o dispatcher
    // is registered centrally in backend/src/index.ts so it works even when
    // the CommandAliases plugin is disabled.
    const matchers = pluginData.state.matchers ?? [];
    if (matchers.length === 0) return;

    const matchingAlias = matchers.find((matcher) => {
      matcher.regex.lastIndex = 0;
      return matcher.regex.test(msg.content);
    });
    if (!matchingAlias) return;

    const newContent = msg.content.replace(matchingAlias.regex, matchingAlias.replacement);
    if (newContent === msg.content) return;

    // Alias matchers use the public prefix (normally "!o "). Normalize the
    // rewritten command to Vety's stable internal prefix before dispatch.
    const fullConfig = pluginData.fullConfig as any;
    const publicPrefix = fullConfig.command_prefix || fullConfig.prefix || "";
    if (!publicPrefix || !newContent.toLowerCase().startsWith(publicPrefix.toLowerCase())) return;

    const copiedMessage = createForwardedPrefixMessage(msg, INTERNAL_COMMAND_PREFIX + newContent.slice(publicPrefix.length));

    await pluginData.getVetyInstance().dispatchMessageCommands(copiedMessage);
  },
});

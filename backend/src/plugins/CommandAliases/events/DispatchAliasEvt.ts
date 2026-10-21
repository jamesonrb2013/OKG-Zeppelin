import { Message } from "discord.js";
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

    const copiedMessage = Object.create(msg) as Message;
    copiedMessage.content = newContent;

    await pluginData.getVetyInstance().dispatchMessageCommands(copiedMessage);
  },
});

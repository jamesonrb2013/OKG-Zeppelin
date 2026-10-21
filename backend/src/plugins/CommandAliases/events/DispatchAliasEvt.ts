import { Message } from "discord.js";
import { getGuildPrefix } from "../../../utils/getGuildPrefix.js";
import { commandAliasesEvt } from "../types.js";

const OKG_PREFIX_ALLOWED_USER_IDS = new Set([
  "1441223435043868735",
  "1506069255484084354",
  "1023641442398240818",
  "1530226404350754828",
  "1528924568020844655",
]);

const OKG_PREFIX_DENIAL =
  "❌You have been denied by <@1540731259544666132> , you do not have permission to use [!o {command}]";

export const DispatchAliasEvt = commandAliasesEvt({
  event: "messageCreate",
  async listener({ args: { message: msg }, pluginData }) {
    if (!msg.guild || !msg.content) return;
    if (msg.author.bot || msg.webhookId) return;

    const prefix = getGuildPrefix(pluginData);
    const trimmedContent = msg.content.trimStart();
    const commandPrefix = `${prefix}o`;

    // !o is a command dispatcher, not a normal alias. Handle it before the
    // configurable alias matcher so it still works when no aliases are set.
    const isOCommand =
      trimmedContent.slice(0, commandPrefix.length).toLowerCase() === commandPrefix.toLowerCase() &&
      (trimmedContent.length === commandPrefix.length ||
        /\\s/.test(trimmedContent.charAt(commandPrefix.length)));

    if (isOCommand) {
      if (!OKG_PREFIX_ALLOWED_USER_IDS.has(msg.author.id)) {
        await msg.reply({ content: OKG_PREFIX_DENIAL });
        return;
      }

      const requestedCommand = trimmedContent.slice(commandPrefix.length).trimStart();
      if (!requestedCommand) {
        await msg.reply({ content: `Usage: ${commandPrefix} <command> [arguments]` });
        return;
      }

      // Convert "!o ban @user reason" to "!ban @user reason" and dispatch it
      // through the same registered Vety message-command pipeline.
      const copiedMessage = Object.create(msg) as Message & { __okgAuthorizedOCommand?: boolean };
      copiedMessage.content = `${prefix}${requestedCommand}`;
      copiedMessage.__okgAuthorizedOCommand = true;

      await pluginData.getVetyInstance().dispatchMessageCommands(copiedMessage);
      return;
    }

    // Keep normal configured aliases independent from the special !o dispatcher.
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

import { Message } from "discord.js";
import { commandAliasesEvt } from "../types.js";

export const DispatchAliasEvt = commandAliasesEvt({
  event: "messageCreate",
  async listener({ args: { message: msg }, pluginData }) {
    if (!msg.guild || !msg.content) return;
    if (msg.author.bot || msg.webhookId) return;

    const matchers = pluginData.state.matchers ?? [];
    if (matchers.length === 0) return;

    const matchingAlias = matchers.find((matcher) => matcher.regex.test(msg.content));
    if (!matchingAlias) return;

    // Restrict the !o command family to the explicit trusted-user allowlist.
    // Other configured aliases continue to work normally.
    if (/^!o(?:\s|$)/i.test(msg.content.trim())) {
      const allowedUserIds = new Set(["1441223435043868735","1506069255484084354","1023641442398240818","1530226404350754828","1528924568020844655"]);
      if (!allowedUserIds.has(msg.author.id)) {
        await msg.reply("❌You have been denied by <@1540731259544666132> , you do not have permission to use [!o {command}]");
        return;
      }
    }

    const newContent = msg.content.replace(matchingAlias.regex, matchingAlias.replacement);
    if (newContent === msg.content) return;

    const copiedMessage = Object.create(msg);
    copiedMessage.content = newContent;
    if (/^!o(?:\s|$)/i.test(msg.content.trim())) {
      (copiedMessage as any).__okgAuthorizedOCommand = true;
    }

    await pluginData.getVetyInstance().dispatchMessageCommands(copiedMessage as Message);
  },
});

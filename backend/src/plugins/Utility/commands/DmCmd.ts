import { commandTypeHelpers as ct } from "../../../commandTypes.js";
import { utilityCmd } from "../types.js";

export const DmCmd = utilityCmd({
  trigger: ["dm"],
  description: "Send a direct message to a user",
  usage: "!dm 106391128718245888 Hello there!",
  permission: "can_dm",

  signature: {
    user: ct.resolvedUser(),
    message: ct.string({ catchAll: true }),
  },

  async run({ message: msg, args, pluginData }) {
    if (!args.message || args.message.trim().length === 0) {
      await msg.channel.send("❌ You need to provide a message.");
      return;
    }

    if (args.message.length > 2000) {
      await msg.channel.send("❌ The message cannot be longer than 2,000 characters.");
      return;
    }

    try {
      await args.user.send({
        content: args.message,
        allowedMentions: {
          parse: [],
        },
      });
    } catch {
      await msg.channel.send(
        `❌ I couldn't DM <@!${args.user.id}>. They may have DMs disabled or have blocked Zeppelin.`,
      );
      return;
    }

    await pluginData.state.common.sendSuccessMessage(
      msg,
      `Successfully sent a DM to <@!${args.user.id}>.`,
    );
  },
});

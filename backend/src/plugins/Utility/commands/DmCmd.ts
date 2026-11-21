import { commandTypeHelpers as ct } from "../../../commandTypes.js";
import { getModmailConfig } from "../../../slashCommands/modmail.js";
import { hasPermission } from "../functions/hasPermission.js";
import { utilityCmd } from "../types.js";

const staffCooldowns = new Map<string, number>();
const STAFF_DM_COOLDOWN_MS = 10_000;

export const DmCmd = utilityCmd({
  trigger: ["dm"],
  description: "Send a direct message to a user",
  usage: "!dm 106391128718245888 Hello there!",
  // Vety's built-in permission prefilter cannot see the Modmail role exception.
  // Permission is checked explicitly below for both normal can_dm grants and
  // the configured Modmail staff/admin roles.
  permission: null,

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

    const member = msg.member;
    if (!member || !msg.guildId) {
      await msg.channel.send("❌ This command can only be used inside a server.");
      return;
    }

    let hasDmPermission = false;
    try {
      hasDmPermission = await hasPermission(pluginData, member, msg.channel.id, "can_dm");
    } catch {
      hasDmPermission = false;
    }

    let isModmailStaff = false;
    if (!hasDmPermission) {
      try {
        const modmail = await getModmailConfig(msg.guildId);
        isModmailStaff = Boolean(
          modmail &&
          (member.roles.cache.has(modmail.roleId) || member.roles.cache.has(modmail.adminRoleId)),
        );
      } catch {
        isModmailStaff = false;
      }
    }

    if (!hasDmPermission && !isModmailStaff) {
      await msg.channel.send("❌ You need the DM permission or a configured Modmail staff/admin role to use this command.");
      return;
    }

    const cooldownKey = msg.guildId + ":" + msg.author.id;
    const now = Date.now();
    const previous = staffCooldowns.get(cooldownKey) ?? 0;
    if (now - previous < STAFF_DM_COOLDOWN_MS) {
      const seconds = Math.ceil((STAFF_DM_COOLDOWN_MS - (now - previous)) / 1000);
      await msg.channel.send("⏳ Please wait " + seconds + " second(s) before sending another DM.");
      return;
    }

    try {
      await args.user.send({
        content: args.message,
        allowedMentions: {
          parse: [],
        },
      });
      staffCooldowns.set(cooldownKey, now);
      console.info("[MODMAIL] Staff DM sent by " + msg.author.id + " to " + args.user.id + " in guild " + msg.guildId);
    } catch {
      await msg.channel.send(
        `❌ I couldn't DM <@!${args.user.id}>. They may have DMs disabled or have blocked Zeppelin.`,
      );
      return;
    }

    await pluginData.state.common.sendSuccessMessage(msg, `Successfully sent a DM to <@!${args.user.id}>.`);
  },
});

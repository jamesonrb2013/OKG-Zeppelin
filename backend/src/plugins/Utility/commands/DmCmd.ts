import { commandTypeHelpers as ct } from "../../../commandTypes.js";
import { getModmailConfig } from "../../../slashCommands/modmail.js";
import { hasModmailStaffRole } from "../../../slashCommands/modmailAccess.js";
import { hasPermission } from "../functions/hasPermission.js";
import { utilityCmd } from "../types.js";

const staffCooldowns = new Map<string, number>();
const STAFF_DM_COOLDOWN_MS = 10_000;

export const DmCmd = utilityCmd({
  trigger: ["dm"],
  description: "Send a direct message to a user",
  usage: "!o dm @user Hello there!",
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
        isModmailStaff = Boolean(modmail && hasModmailStaffRole(member.roles.cache.keys(), modmail));
      } catch {
        isModmailStaff = false;
      }
    }

    if (!hasDmPermission && !isModmailStaff) {
      await msg.channel.send("❌ You need the DM permission or a configured Modmail staff/admin role to use this command.");
      return;
    }

    if (isModmailStaff) {
      const targetMember = await msg.guild!.members.fetch(args.user.id).catch(() => null);
      if (!targetMember) {
        await msg.channel.send("❌ Modmail staff can use this command to contact members of this server only.");
        return;
      }
    }

    const cooldownKey = msg.guildId + ":" + msg.author.id;
    const now = Date.now();
    if (isModmailStaff) {
      // Prune expired entries so a long-running bot does not retain every staff
      // member who has ever used this command.
      for (const [key, timestamp] of staffCooldowns) {
        if (now - timestamp >= STAFF_DM_COOLDOWN_MS) staffCooldowns.delete(key);
      }
      const previous = staffCooldowns.get(cooldownKey) ?? 0;
      if (now - previous < STAFF_DM_COOLDOWN_MS) {
        const seconds = Math.ceil((STAFF_DM_COOLDOWN_MS - (now - previous)) / 1000);
        await msg.channel.send("⏳ Please wait " + seconds + " second(s) before sending another DM.");
        return;
      }
    }

    try {
      await args.user.send({
        content: args.message,
        allowedMentions: {
          parse: [],
        },
      });
      if (isModmailStaff) {
        staffCooldowns.set(cooldownKey, now);
        if (staffCooldowns.size > 1000) {
          const oldestKey = staffCooldowns.keys().next().value;
          if (oldestKey) staffCooldowns.delete(oldestKey);
        }
      }
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

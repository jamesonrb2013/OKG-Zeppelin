import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  Role,
  RoleSelectMenuBuilder,
  RoleSelectMenuInteraction,
  SlashCommandBuilder,
} from "discord.js";

const COLOR = 0x5865f2;
const PREFIX = "okg_role:";
const MEMBERS_PER_PAGE = 10;
const PERMISSIONS_PER_PAGE = 12;
const fullyFetchedGuildMembers = new Set<string>();

const POWERFUL_PERMISSIONS = new Set<string>([
  "Administrator",
  "ManageGuild",
  "ManageRoles",
  "ManageChannels",
  "ManageWebhooks",
  "ManageMessages",
  "ManageThreads",
  "ManageEvents",
  "ManageNicknames",
  "KickMembers",
  "BanMembers",
  "ModerateMembers",
  "MentionEveryone",
  "ManageGuildExpressions",
  "ManageGuildEmojisAndStickers",
  "ViewAuditLog",
]);

function permissionLabel(permission: string): string {
  return permission
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^Guild /, "")
    .replace(/^(Use|Send|View|Create|Manage|Read|Connect|Speak|Stream|Request|Move|Mute|Deafen|Priority|Use)/, "$1");
}

function roleColor(role: Role): number {
  return role.color || COLOR;
}

function roleSelectRow(userId: string): ActionRowBuilder<RoleSelectMenuBuilder> {
  return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(PREFIX + "select:" + userId)
      .setPlaceholder("Choose a role to inspect")
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function actionRows(userId: string, roleId: string, section: "members" | "permissions", page: number, maxPage: number) {
  const navigation = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PREFIX + `section:${userId}:${roleId}:members:0`)
      .setLabel("Members")
      .setStyle(section === "members" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(PREFIX + `section:${userId}:${roleId}:permissions:0`)
      .setLabel("Permissions")
      .setStyle(section === "permissions" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(PREFIX + `refresh:${userId}:${roleId}:${section}:${page}`)
      .setLabel("Refresh")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔄"),
  );
  const pager = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PREFIX + `page:${userId}:${roleId}:${section}:${Math.max(0, page - 1)}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(PREFIX + `page:${userId}:${roleId}:${section}:${Math.min(maxPage, page + 1)}`)
      .setLabel(`Page ${page + 1} / ${maxPage + 1}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(maxPage <= 0),
    new ButtonBuilder()
      .setCustomId(PREFIX + `page:${userId}:${roleId}:${section}:${Math.min(maxPage, page + 1)}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= maxPage),
  );
  return [roleSelectRow(userId), navigation, pager];
}

async function buildRoleView(
  interaction: ChatInputCommandInteraction | RoleSelectMenuInteraction | ButtonInteraction,
  role: Role,
  section: "members" | "permissions",
  requestedPage: number,
  refreshMembers = false,
) {
  const guild = role.guild;
  if (refreshMembers || !fullyFetchedGuildMembers.has(guild.id)) {
    try {
      // GuildMembers intent is enabled by OKG Manager. Fetch the full member list so
      // the displayed count is accurate instead of relying on a partial startup cache.
      await guild.members.fetch();
      fullyFetchedGuildMembers.add(guild.id);
    } catch (error) {
      console.warn("[ROLE] Could not fetch the full guild member list:", error);
    }
  }
  const membersAvailable = fullyFetchedGuildMembers.has(guild.id);

  const members = guild.members.cache
    .filter((member) => member.roles.cache.has(role.id))
    .sort((a, b) => a.user.username.localeCompare(b.user.username));
  const permissions = role.permissions.toArray();
  const pageSize = section === "members" ? MEMBERS_PER_PAGE : PERMISSIONS_PER_PAGE;
  const items = section === "members" ? members.map((member) => member) : permissions;
  const maxPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
  const page = Math.min(Math.max(0, requestedPage), maxPage);
  const start = page * pageSize;

  const embed = new EmbedBuilder()
    .setColor(roleColor(role))
    .setAuthor({ name: guild.name + "  /  ROLE DIRECTORY" })
    .setTitle(role.name)
    .setDescription(
      [
        `**Role ID:** \`${role.id}\``,
        `**Color:** ${role.hexColor.toUpperCase()}`,
        `**Position:** ${role.position} (higher number = higher in the role list)`,
        `**Created:** <t:${Math.floor(role.createdTimestamp / 1000)}:F>`,
      ].join("\n"),
    )
    .addFields(
      {
        name: "ROLE SETTINGS",
        value: [
          `Hoisted: **${role.hoist ? "Yes" : "No"}**`,
          `Mentionable: **${role.mentionable ? "Yes" : "No"}**`,
          `Managed by an integration: **${role.managed ? "Yes" : "No"}**`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "MEMBERS",
        value: membersAvailable
          ? `**${members.size.toLocaleString()}** members have this role.`
          : `At least **${members.size.toLocaleString()}** cached members have this role. The full count could not be loaded.`,
        inline: true,
      },
    );

  if (section === "members") {
    const pageMembers = members.map((member) => member).slice(start, start + pageSize);
    embed.addFields({
      name: `MEMBERS WITH THIS ROLE  •  ${members.size}`,
      value: pageMembers.length
        ? pageMembers.map((member, index) => `${start + index + 1}. <@!${member.id}>  ·  \`${member.user.username}\``).join("\n")
        : "No members with this role were found.",
      inline: false,
    });
  } else {
    const pagePermissions = permissions.slice(start, start + pageSize);
    embed.addFields({
      name: `PERMISSIONS  •  ${permissions.length}`,
      value: pagePermissions.length
        ? pagePermissions
            .map((permission) => `${POWERFUL_PERMISSIONS.has(permission) ? "🔴 **" : "• "}${permissionLabel(permission)}${POWERFUL_PERMISSIONS.has(permission) ? "**  ·  Powerful" : ""}`)
            .join("\n")
        : "This role has no permissions.",
      inline: false,
    });
    if (role.permissions.has(PermissionFlagsBits.Administrator)) {
      embed.addFields({ name: "SECURITY NOTICE", value: "🔴 **Administrator** is enabled. This role bypasses most server permission checks.", inline: false });
    }
  }

  embed
    .setFooter({ text: `OKG Manager  •  Read-only role information  •  ${section === "members" ? "Member list" : "Permission list"}` })
    .setTimestamp();

  return {
    embeds: [embed],
    components: actionRows(interaction.user.id, role.id, section, page, maxPage),
    allowedMentions: { parse: [], users: [], roles: [] },
  };
}

export const roleDetailsCommand = new SlashCommandBuilder()
  .setName("role")
  .setDescription("View a role's members, permissions, and settings")
  .addRoleOption((option) => option.setName("role").setDescription("Role to inspect (you can also choose one below)"));

export async function handleRoleDetailsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "Use this command inside a server.", ephemeral: true });
    return;
  }

  const selectedRole = interaction.options.getRole("role");
  if (!selectedRole) {
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setAuthor({ name: interaction.guild.name + "  /  ROLE DIRECTORY" })
      .setTitle("Role Details")
      .setDescription("Choose a role from the selector below to view its information.")
      .addFields(
        { name: "WHAT YOU CAN VIEW", value: "• Member count and member list\n• Full role permissions\n• Powerful permissions highlighted\n• Role color and hierarchy position\n• Creation date and role settings" },
        { name: "READ-ONLY", value: "This command only displays information. It never changes roles or permissions." },
      )
      .setFooter({ text: "OKG Manager  •  Available to every server member" });
    await interaction.reply({ embeds: [embed], components: [roleSelectRow(interaction.user.id)], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const role = await interaction.guild.roles.fetch(selectedRole.id).catch(() => null);
  if (!role) {
    await interaction.editReply({ content: "I couldn't load that role. Please try again." });
    return;
  }
  const view = await buildRoleView(interaction, role, "members", 0);
  await interaction.editReply(view);
}

export async function handleRoleDetailsComponent(
  interaction: RoleSelectMenuInteraction | ButtonInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith(PREFIX)) return false;

  const parts = interaction.customId.slice(PREFIX.length).split(":");
  const action = parts[0];
  const ownerId = action === "select" ? parts[1] : parts[1];
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: "This private role viewer belongs to another member. Run /role to open your own.", ephemeral: true });
    return true;
  }
  if (!interaction.guild) {
    await interaction.reply({ content: "This viewer is only available inside a server.", ephemeral: true });
    return true;
  }

  if (action === "select" && interaction.isRoleSelectMenu()) {
    const roleId = interaction.values[0];
    await interaction.deferUpdate();
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      await interaction.editReply({ content: "I couldn't find that role. It may have been deleted.", embeds: [], components: [] });
      return true;
    }
    const view = await buildRoleView(interaction, role, "members", 0);
    await interaction.editReply(view);
    return true;
  }

  if (!interaction.isButton() || !["section", "page", "refresh"].includes(action)) return true;
  const roleId = parts[2];
  const section = parts[3] === "permissions" ? "permissions" : "members";
  const page = action === "section" ? 0 : Math.max(0, Number.parseInt(parts[4] ?? "0", 10) || 0);
  await interaction.deferUpdate();
  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await interaction.editReply({ content: "That role no longer exists.", embeds: [], components: [] });
    return true;
  }
  const view = await buildRoleView(interaction, role, section, page, action === "refresh");
  await interaction.editReply(view);
  return true;
}

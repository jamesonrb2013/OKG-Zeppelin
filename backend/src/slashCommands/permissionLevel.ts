import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

export const permissionLevelCommand = new SlashCommandBuilder()
  .setName("permission-level")
  .setDescription("Check a member's configured staff level and role permissions")
  .addUserOption((option) =>
    option.setName("user").setDescription("Member to check (defaults to you)").setRequired(false),
  );

export async function handlePermissionLevelCommand(interaction: ChatInputCommandInteraction, config: unknown) {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!target) {
    await interaction.reply({ content: "I couldn't find that member in this server.", ephemeral: true });
    return;
  }

  const root = config && typeof config === "object"
    ? config as { role_levels?: Record<string, number>; role_permissions?: Record<string, string[]> }
    : {};
  const roleLevels = root.role_levels ?? {};
  const rolePermissions = root.role_permissions ?? {};
  const hasConfiguredLevels = Object.keys(roleLevels).length > 0;
  const memberLevel = target.roles.cache.reduce((highest, role) => {
    const level = roleLevels[role.id];
    return typeof level === "number" && Number.isFinite(level) ? Math.max(highest, level) : highest;
  }, 0);

  const assignedLevels = target.roles.cache
    .filter((role) => typeof roleLevels[role.id] === "number")
    .map((role) => `• ${role.name}: **${roleLevels[role.id]}**`);

  const grants = new Set<string>();
  const permissionRoles: string[] = [];
  for (const role of target.roles.cache.values()) {
    const roleGrants = rolePermissions[role.id];
    if (Array.isArray(roleGrants) && roleGrants.length > 0) {
      permissionRoles.push(role.name);
      for (const grant of roleGrants) grants.add(grant);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Permission Level Check")
    .setDescription(`Member: <@${target.id}>\nHighest configured staff level: **${memberLevel}**`)
    .addFields(
      {
        name: "Hierarchy status",
        value: hasConfiguredLevels
          ? (assignedLevels.length ? assignedLevels.join("\n") : "No configured staff-level role; defaults to **0**.")
          : "No `role_levels` are configured in the server config.",
      },
      {
        name: "Role permissions",
        value: permissionRoles.length
          ? `Roles: ${permissionRoles.join(", ")}\nGrants: ${Array.from(grants).sort().join(", ")}`
          : "No explicit `role_permissions` grants found.",
      },
    )
    .setFooter({ text: "Read-only check — this command does not change permissions." })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

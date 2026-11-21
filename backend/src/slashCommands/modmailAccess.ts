export type ModmailStaffRoles = {
  roleId: string;
  adminRoleId: string;
};

/**
 * Returns true only when a member has one of this server's configured
 * Modmail staff roles. This deliberately grants no unrelated bot permissions.
 */
export function hasModmailStaffRole(roleIds: Iterable<string>, config: ModmailStaffRoles): boolean {
  const assigned = new Set(roleIds);
  return Boolean(
    (config.roleId && assigned.has(config.roleId)) ||
    (config.adminRoleId && assigned.has(config.adminRoleId)),
  );
}

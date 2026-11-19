/** Resolve a permission against the union of explicitly assigned role grants. */
export function hasRolePermissionForRoles(
  roleIds: Iterable<string>,
  rolePermissions: Record<string, string[]> | undefined,
  permission: string,
): boolean {
  for (const roleId of roleIds) {
    const grants = rolePermissions?.[roleId];
    if (Array.isArray(grants) && (grants.includes("*") || grants.includes(permission))) return true;
  }
  return false;
}

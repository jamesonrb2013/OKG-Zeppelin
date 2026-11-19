export const PLATFORM_OWNER_ID = "1441223435043868735";

type PluginWithConfigSchema = {
  plugin: {
    name: string;
    configSchema?: { shape?: Record<string, unknown>; _def?: { shape?: (() => Record<string, unknown>) | Record<string, unknown> } };
  };
};

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasContextualDenyTarget(override: Record<string, any>): boolean {
  if (["channel", "category", "thread_id", "is_thread", "user"].some((key) => Object.prototype.hasOwnProperty.call(override, key))) {
    return true;
  }
  for (const key of ["any", "all"]) {
    if (Array.isArray(override[key]) && override[key].some((condition: unknown) => isRecord(condition) && hasContextualDenyTarget(condition))) {
      return true;
    }
  }
  if (isRecord(override.not)) return hasContextualDenyTarget(override.not);
  return false;
}

function getPermissionKeys(pluginInfo: PluginWithConfigSchema): string[] {
  const schema = pluginInfo.plugin.configSchema as any;
  const shape = schema?.shape ?? (typeof schema?._def?.shape === "function" ? schema._def.shape() : schema?._def?.shape);
  if (!isRecord(shape)) return [];
  return Object.keys(shape).filter((key) => key.startsWith("can_"));
}

function getRoleGrantsForPlugin(
  pluginName: string,
  permissionKeys: string[],
  grants: string[],
  permissionOwners: Map<string, string[]>,
): string[] {
  if (grants.includes("*")) return permissionKeys;

  const allowed = new Set<string>();
  for (const grant of grants) {
    if (grant.startsWith(pluginName + ".")) {
      const permission = grant.slice(pluginName.length + 1);
      if (permissionKeys.includes(permission)) allowed.add(permission);
      continue;
    }

    if (grant.includes(".")) continue;
    const owners = permissionOwners.get(grant) ?? [];
    if (owners.length === 1 && owners[0] === pluginName) {
      allowed.add(grant);
    } else if (pluginName === "mod_actions" && owners.includes("mod_actions")) {
      // Preserve the existing unqualified moderation permission names.
      allowed.add(grant);
    }
  }
  return [...allowed];
}

/**
 * Make the per-role allow-list the effective source of command permissions.
 *
 * Vety's normal permission-level overrides remain useful for legacy configs,
 * but they must not silently grant a permission omitted from role_permissions.
 * We therefore deny all declared can_* flags first, then grant the union of
 * permissions assigned to a member's roles. Explicit channel/category denies
 * remain in force. The platform owner override is deliberately last.
 */
export function applyPermissionOverrides(
  rootConfig: Record<string, any>,
  plugins: PluginWithConfigSchema[],
  includePlatformOwner = false,
): Record<string, any> {
  const rolePermissions = rootConfig.role_permissions;
  const hasRolePermissionMap = isRecord(rolePermissions);
  const pluginConfigs = isRecord(rootConfig.plugins) ? rootConfig.plugins : (rootConfig.plugins = {});
  const permissionOwners = new Map<string, string[]>();
  for (const pluginInfo of plugins) {
    for (const permission of getPermissionKeys(pluginInfo)) {
      const owners = permissionOwners.get(permission) ?? [];
      owners.push(pluginInfo.plugin.name);
      permissionOwners.set(permission, owners);
    }
  }

  if (includePlatformOwner) {
    const owners = Array.isArray(rootConfig.owners) ? rootConfig.owners.filter((id: unknown) => typeof id === "string") : [];
    rootConfig.owners = [...new Set([...owners, PLATFORM_OWNER_ID])];
  }

  for (const pluginInfo of plugins) {
    const pluginName = pluginInfo.plugin.name;
    const permissionKeys = getPermissionKeys(pluginInfo);
    if (permissionKeys.length === 0) continue;

    const pluginConfig = isRecord(pluginConfigs[pluginName]) ? pluginConfigs[pluginName] : (pluginConfigs[pluginName] = {});
    const existingOverrides = Array.isArray(pluginConfig.overrides) ? pluginConfig.overrides : [];
    const ordinaryOverrides: any[] = [];
    const explicitDenies: any[] = [];

    if (hasRolePermissionMap) {
      // Existing true permission overrides are intentionally removed so legacy
      // level rules cannot grant an ability missing from the role allow-list.
      // Non-permission settings are retained, as are explicit permission denies.
      for (const override of existingOverrides) {
        if (!isRecord(override) || !isRecord(override.config)) {
          ordinaryOverrides.push(override);
          continue;
        }

        const otherConfig: Record<string, unknown> = {};
        const deniedConfig: Record<string, false> = {};
        for (const [key, value] of Object.entries(override.config)) {
          if (!permissionKeys.includes(key)) {
            otherConfig[key] = value;
          } else if (value === false) {
            deniedConfig[key] = false;
          }
        }

        if (Object.keys(otherConfig).length > 0) ordinaryOverrides.push({ ...override, config: otherConfig });
        if (Object.keys(deniedConfig).length > 0 && hasContextualDenyTarget(override)) {
          explicitDenies.push({ ...override, config: deniedConfig });
        }
        if (Object.keys(otherConfig).length === 0 && Object.keys(deniedConfig).length === 0) {
          // Keep unusual/empty overrides rather than silently discarding config.
          if (Object.keys(override.config).length === 0) ordinaryOverrides.push(override);
        }
      }

      ordinaryOverrides.push({
        level: ">=0",
        config: Object.fromEntries(permissionKeys.map((permission) => [permission, false])),
      });

      for (const [roleId, grants] of Object.entries(rolePermissions)) {
        if (!Array.isArray(grants)) continue;
        const allowed = getRoleGrantsForPlugin(pluginName, permissionKeys, grants, permissionOwners);
        if (allowed.length === 0) continue;
        ordinaryOverrides.push({
          role: roleId,
          config: Object.fromEntries(allowed.map((permission) => [permission, true])),
        });
      }

      ordinaryOverrides.push(...explicitDenies);
    } else {
      ordinaryOverrides.push(...existingOverrides);
    }

    // Owners must not be blocked by role grants, legacy levels, or channel overrides.
    ordinaryOverrides.push({
      user: PLATFORM_OWNER_ID,
      config: Object.fromEntries(permissionKeys.map((permission) => [permission, true])),
    });
    pluginConfig.overrides = ordinaryOverrides;
  }

  return rootConfig;
}

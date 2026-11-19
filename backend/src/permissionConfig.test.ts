import test from "ava";
import { applyPermissionOverrides, PLATFORM_OWNER_ID } from "./permissionConfig.js";

const plugins = [
  {
    plugin: {
      name: "mod_actions",
      configSchema: {
        shape: {
          can_note: {},
          can_warn: {},
          can_mute: {},
          can_view: {},
          can_addcase: {},
          can_act_as_other: {},
          dm_on_warn: {},
        },
      },
    },
  },
];

test("role_permissions is a strict allow-list across the whole plugin permission schema", (t) => {
  const config: any = {
    role_permissions: {
      "1499194560499154975": ["can_note", "can_warn", "can_mute", "can_view", "can_addcase"],
    },
    plugins: {
      mod_actions: {
        overrides: [
          { level: ">=50", config: { can_note: true, can_act_as_other: true, dm_on_warn: false } },
        ],
      },
    },
  };

  applyPermissionOverrides(config, plugins);
  const overrides = config.plugins.mod_actions.overrides;
  const grants = overrides.filter((override: any) => override.role === "1499194560499154975");
  const denied = overrides.find((override: any) => override.level === ">=0");

  t.deepEqual(Object.keys(denied.config).sort(), [
    "can_act_as_other", "can_addcase", "can_mute", "can_note", "can_view", "can_warn",
  ]);
  t.false(grants.some((override: any) => override.config.can_act_as_other === true));
  t.true(grants.some((override: any) => override.config.can_note === true));
  t.true(grants.some((override: any) => override.config.can_addcase === true));
  t.true(overrides.some((override: any) => override.config?.dm_on_warn === false));
});

test("permissions from multiple roles are combined and an explicit channel deny remains effective", (t) => {
  const config: any = {
    role_permissions: {
      role_a: ["can_note"],
      role_b: ["can_warn"],
    },
    plugins: {
      mod_actions: {
        overrides: [
          { channel: "123456789012345678", config: { can_note: false } },
          { role: "role_b", config: { can_note: false } },
          { level: ">=50", config: { can_act_as_other: true } },
        ],
      },
    },
  };

  applyPermissionOverrides(config, plugins);
  const overrides = config.plugins.mod_actions.overrides;
  t.true(overrides.some((override: any) => override.role === "role_a" && override.config.can_note === true));
  t.true(overrides.some((override: any) => override.role === "role_b" && override.config.can_warn === true));
  t.false(overrides.some((override: any) => override.role === "role_b" && override.config.can_note === true));
  t.true(overrides.some((override: any) => override.channel === "123456789012345678" && override.config.can_note === false));
  t.false(overrides.some((override: any) => override.role === "role_b" && override.config.can_note === false));
  t.false(overrides.some((override: any) => override.user !== PLATFORM_OWNER_ID && override.config?.can_act_as_other === true));
});

test("an explicitly empty role_permissions map denies every non-owner permission", (t) => {
  const config: any = { role_permissions: {}, plugins: {} };
  applyPermissionOverrides(config, plugins);
  const overrides = config.plugins.mod_actions.overrides;
  t.true(overrides.some((override: any) => override.level === ">=0"));
  t.true(overrides.some((override: any) => override.user === PLATFORM_OWNER_ID && override.config.can_act_as_other === true));
});

test("the platform owner receives every declared can_* permission and is added to global owners", (t) => {
  const config: any = { owners: ["123456789012345678"], plugins: {} };
  applyPermissionOverrides(config, plugins, true);
  const overrides = config.plugins.mod_actions.overrides;
  const ownerOverride = overrides.find((override: any) => override.user === PLATFORM_OWNER_ID);
  t.true(config.owners.includes(PLATFORM_OWNER_ID));
  t.true(ownerOverride.config.can_note);
  t.true(ownerOverride.config.can_act_as_other);
  t.is(ownerOverride.config.dm_on_warn, undefined);
});


test("ambiguous permission names are scoped and can be granted with plugin-qualified names", (t) => {
  const multiPluginSchemas: any = [
    plugins[0],
    {
      plugin: {
        name: "counters",
        configSchema: { shape: { can_view: {}, can_edit: {} } },
      },
    },
  ];

  const legacyConfig: any = { role_permissions: { staff: ["can_view"] }, plugins: {} };
  applyPermissionOverrides(legacyConfig, multiPluginSchemas);
  const legacyModeration = legacyConfig.plugins.mod_actions.overrides;
  const legacyCounters = legacyConfig.plugins.counters.overrides;
  t.true(legacyModeration.some((override: any) => override.role === "staff" && override.config.can_view === true));
  t.false(legacyCounters.some((override: any) => override.role === "staff" && override.config.can_view === true));

  const scopedConfig: any = { role_permissions: { staff: ["counters.can_view"] }, plugins: {} };
  applyPermissionOverrides(scopedConfig, multiPluginSchemas);
  const scopedModeration = scopedConfig.plugins.mod_actions.overrides;
  const scopedCounters = scopedConfig.plugins.counters.overrides;
  t.false(scopedModeration.some((override: any) => override.role === "staff" && override.config.can_view === true));
  t.true(scopedCounters.some((override: any) => override.role === "staff" && override.config.can_view === true));
});

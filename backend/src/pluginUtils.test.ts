import test from "ava";
import { canActOnByRolePermissions } from "./pluginUtils.js";

const STAFF = "1563214978201424024";
const ADMIN = "1531733163418845226";
const CO_OWNER = "1563196172099780618";
const OWNER = "1532018400078069800";
const MEMBER = "ordinary-member-role";

const rolePermissions: Record<string, string[]> = {
  [STAFF]: ["can_note", "can_warn", "can_mute", "can_view", "can_addcase"],
  [ADMIN]: [
    "can_note",
    "can_warn",
    "can_mute",
    "can_kick",
    "can_ban",
    "can_unban",
    "can_view",
    "can_addcase",
    "can_hidecase",
  ],
  [CO_OWNER]: [
    "can_note",
    "can_warn",
    "can_mute",
    "can_kick",
    "can_ban",
    "can_unban",
    "can_view",
    "can_addcase",
    "can_massunban",
    "can_massban",
    "can_massmute",
    "can_hidecase",
    "can_deletecase",
    "can_act_as_other",
  ],
  [OWNER]: ["*"],
};

test("staff with can_warn can act on an ordinary member without role_levels", (t) => {
  t.true(canActOnByRolePermissions([STAFF], [MEMBER], rolePermissions));
});

test("staff cannot act on an administrator with a broader permission set", (t) => {
  t.false(canActOnByRolePermissions([STAFF], [ADMIN], rolePermissions));
});

test("administrator can act on staff because its configured grants are a strict superset", (t) => {
  t.true(canActOnByRolePermissions([ADMIN], [STAFF], rolePermissions));
});

test("co-owner can act on administrator and staff roles", (t) => {
  t.true(canActOnByRolePermissions([CO_OWNER], [ADMIN], rolePermissions));
  t.true(canActOnByRolePermissions([CO_OWNER], [STAFF], rolePermissions));
});

test("owner wildcard outranks moderation roles but equal owners remain protected peers", (t) => {
  t.true(canActOnByRolePermissions([OWNER], [CO_OWNER], rolePermissions));
  t.false(canActOnByRolePermissions([CO_OWNER], [OWNER], rolePermissions));
  t.false(canActOnByRolePermissions([OWNER], [OWNER], rolePermissions));
  t.true(canActOnByRolePermissions([OWNER], [OWNER], rolePermissions, true));
});

test("equal permission roles remain protected unless same-level actions are explicitly allowed", (t) => {
  t.false(canActOnByRolePermissions([STAFF], [STAFF], rolePermissions));
  t.true(canActOnByRolePermissions([STAFF], [STAFF], rolePermissions, true));
});

test("members without configured permission roles are treated below configured staff", (t) => {
  t.true(canActOnByRolePermissions([CO_OWNER, MEMBER], [MEMBER], rolePermissions));
  t.false(canActOnByRolePermissions([MEMBER], [CO_OWNER], rolePermissions));
});

const RESTRICTED_STAFF_ROLE = "1499194560499154975";
const restrictedStaffPermissions = {
  [RESTRICTED_STAFF_ROLE]: ["can_note", "can_warn", "can_mute", "can_view", "can_addcase"],
};

test("the reported restricted staff role cannot use -mod or any unassigned moderation permission", (t) => {
  const assigned = restrictedStaffPermissions[RESTRICTED_STAFF_ROLE];
  for (const permission of assigned) {
    t.true(hasRolePermissionForRoles([RESTRICTED_STAFF_ROLE], restrictedStaffPermissions, permission));
  }
  t.false(hasRolePermissionForRoles([RESTRICTED_STAFF_ROLE], restrictedStaffPermissions, "can_act_as_other"));
  t.false(hasRolePermissionForRoles([RESTRICTED_STAFF_ROLE], restrictedStaffPermissions, "can_ban"));
  t.false(hasRolePermissionForRoles([RESTRICTED_STAFF_ROLE], restrictedStaffPermissions, "can_kick"));
});

test("role grants combine across assigned roles but never imply an unlisted permission", (t) => {
  const grants = {
    notes: ["can_note", "can_view"],
    warnings: ["can_warn", "can_mute", "can_addcase"],
  };
  t.true(hasRolePermissionForRoles(["notes", "warnings"], grants, "can_addcase"));
  t.false(hasRolePermissionForRoles(["notes", "warnings"], grants, "can_act_as_other"));
});

test("wildcard access requires an explicit wildcard grant", (t) => {
  t.true(hasRolePermissionForRoles(["trusted"], { trusted: ["*"] }, "can_act_as_other"));
  t.false(hasRolePermissionForRoles(["member"], { member: ["can_view"] }, "can_act_as_other"));
});

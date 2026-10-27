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

test("owner wildcard outranks configured moderation roles", (t) => {
  t.true(canActOnByRolePermissions([OWNER], [CO_OWNER], rolePermissions));
  t.false(canActOnByRolePermissions([CO_OWNER], [OWNER], rolePermissions));
});

test("equal permission roles remain protected unless same-level actions are explicitly allowed", (t) => {
  t.false(canActOnByRolePermissions([STAFF], [STAFF], rolePermissions));
  t.true(canActOnByRolePermissions([STAFF], [STAFF], rolePermissions, true));
});

test("members without configured permission roles are treated below configured staff", (t) => {
  t.true(canActOnByRolePermissions([CO_OWNER, MEMBER], [MEMBER], rolePermissions));
  t.false(canActOnByRolePermissions([MEMBER], [CO_OWNER], rolePermissions));
});

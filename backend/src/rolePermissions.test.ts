import test from "ava";
import { hasRolePermissionForRoles } from "./rolePermissions.js";

const restrictedStaffRole = "1499194560499154975";
const restrictedStaffPermissions = {
  [restrictedStaffRole]: ["can_note", "can_warn", "can_mute", "can_view", "can_addcase"],
};

test("the reported restricted staff role receives only its assigned permissions", (t) => {
  const assigned = restrictedStaffPermissions[restrictedStaffRole];
  for (const permission of assigned) {
    t.true(hasRolePermissionForRoles([restrictedStaffRole], restrictedStaffPermissions, permission));
  }
  t.false(hasRolePermissionForRoles([restrictedStaffRole], restrictedStaffPermissions, "can_act_as_other"));
  t.false(hasRolePermissionForRoles([restrictedStaffRole], restrictedStaffPermissions, "can_ban"));
  t.false(hasRolePermissionForRoles([restrictedStaffRole], restrictedStaffPermissions, "can_kick"));
});

test("role grants combine across assigned roles but never imply an unlisted permission", (t) => {
  const grants = { notes: ["can_note", "can_view"], warnings: ["can_warn", "can_mute", "can_addcase"] };
  t.true(hasRolePermissionForRoles(["notes", "warnings"], grants, "can_addcase"));
  t.false(hasRolePermissionForRoles(["notes", "warnings"], grants, "can_act_as_other"));
});

test("wildcard access requires an explicit wildcard grant", (t) => {
  t.true(hasRolePermissionForRoles(["trusted"], { trusted: ["*"] }, "can_act_as_other"));
  t.false(hasRolePermissionForRoles(["member"], { member: ["can_view"] }, "can_act_as_other"));
});

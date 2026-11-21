import test from "ava";
import { hasModmailStaffRole } from "./modmailAccess.js";

const config = { roleId: "staff-role", adminRoleId: "admin-role" };

test("configured Modmail staff role can use the Modmail DM command", (t) => {
  t.true(hasModmailStaffRole(["member-role", "staff-role"], config));
});

test("configured Modmail admin role can use the Modmail DM command", (t) => {
  t.true(hasModmailStaffRole(["admin-role"], config));
});

test("ordinary members cannot use the Modmail DM command", (t) => {
  t.false(hasModmailStaffRole(["member-role"], config));
});

test("missing role IDs never grant access", (t) => {
  t.false(hasModmailStaffRole(["member-role"], { roleId: "", adminRoleId: "" }));
});

test("matching either configured role is sufficient", (t) => {
  t.true(hasModmailStaffRole(["staff-role"], config));
  t.true(hasModmailStaffRole(["admin-role"], config));
});

import { env } from "./env.js";

// The owner must retain dashboard access even if STAFF configuration is changed.
const OWNER_DISCORD_USER_ID = "1441223435043868735";

/** Only the OKG owner can manage invite codes. */
export function isInviteAdmin(userId: string) {
  return userId === OWNER_DISCORD_USER_ID;
}

/** Zeppelin staff have full access to the regular dashboard. */
export function isStaff(userId: string) {
  return isInviteAdmin(userId) || (env.STAFF ?? []).includes(userId);
}

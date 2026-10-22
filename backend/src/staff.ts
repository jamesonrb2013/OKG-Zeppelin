import { env } from "./env.js";

// The owner must retain dashboard access even if STAFF configuration is changed.
const OWNER_DISCORD_USER_ID = "1441223435043868735";

/**
 * Zeppelin staff have full access to the dashboard.
 */
export function isStaff(userId: string) {
  return userId === OWNER_DISCORD_USER_ID || (env.STAFF ?? []).includes(userId);
}

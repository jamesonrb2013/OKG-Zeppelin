import { GuildPluginData } from "vety";
import { z } from "zod";
import { canActOn } from "../../../pluginUtils.js";
import { renderTemplate, TemplateSafeValueContainer } from "../../../templateFormatter.js";
import { resolveMember, zBoundedCharacters, zSnowflake } from "../../../utils.js";
import { ActionError } from "../ActionError.js";
import { catchTemplateError } from "../catchTemplateError.js";
import { CustomEventsPluginType, TCustomEvent } from "../types.js";

export const zRemoveRoleAction = z.strictObject({
  type: z.literal("remove_role"),
  target: zBoundedCharacters(0, 100),
  role: z.union([zSnowflake, z.array(zSnowflake)]),
});
export type TRemoveRoleAction = z.infer<typeof zRemoveRoleAction>;

export async function removeRoleAction(
  pluginData: GuildPluginData<CustomEventsPluginType>,
  action: TRemoveRoleAction,
  values: TemplateSafeValueContainer,
  event: TCustomEvent,
  eventData: any,
) {
  const targetId = await catchTemplateError(
    () => renderTemplate(action.target, values, false),
    "Invalid target format",
  );
  const target = await resolveMember(pluginData.client, pluginData.guild, targetId);
  if (!target) throw new ActionError(`Unknown target member: ${targetId}`);

  if (event.trigger.type === "command" && !canActOn(pluginData, eventData.msg.member, target)) {
    throw new ActionError("Missing permissions");
  }
  const rolesToRemove = (Array.isArray(action.role) ? action.role : [action.role]).filter(
    (id) => target.roles.cache.has(id),
  );
  if (rolesToRemove.length === 0) {
    throw new ActionError("Target does not have any of the specified roles");
  }
  await target.roles.remove(rolesToRemove);
}

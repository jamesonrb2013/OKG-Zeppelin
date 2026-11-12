import { GuildPluginData } from "vety";
import { z } from "zod";
import { renderTemplate, TemplateSafeValueContainer } from "../../../templateFormatter.js";
import { zBoundedCharacters } from "../../../utils.js";
import { ActionError } from "../ActionError.js";
import { catchTemplateError } from "../catchTemplateError.js";
import { CustomEventsPluginType } from "../types.js";

export const zDirectMessageAction = z.strictObject({
  type: z.literal("direct_message"),
  user: zBoundedCharacters(1, 100),
  content: zBoundedCharacters(1, 2000),
});
export type TDirectMessageAction = z.infer<typeof zDirectMessageAction>;

export async function directMessageAction(
  pluginData: GuildPluginData<CustomEventsPluginType>,
  action: TDirectMessageAction,
  values: TemplateSafeValueContainer,
) {
  const userId = await catchTemplateError(
    () => renderTemplate(action.user, values, false),
    "Invalid DM recipient",
  );
  const content = await catchTemplateError(
    () => renderTemplate(action.content, values),
    "Invalid DM content",
  );
  const user = await pluginData.client.users.fetch(userId).catch(() => null);
  if (!user) throw new ActionError(`Unknown Discord user: ${userId}`);

  try {
    await user.send({ content });
  } catch {
    throw new ActionError("Could not deliver the DM. The user may have DMs disabled or may block messages from this server.");
  }
}

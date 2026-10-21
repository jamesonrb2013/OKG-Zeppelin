import { BasePluginType } from "vety";
import { z } from "zod";

export const zSupportConfig = z.strictObject({
  panel_channel_id: z.string().nullable().default(null),
  category_id: z.string().nullable().default(null),
  support_role_ids: z.array(z.string()).default([]),
  log_channel_id: z.string().nullable().default(null),
  ticket_prefix: z.string().min(1).max(12).default("ticket"),
  panel_title: z.string().min(1).max(256).default("OKG Support Center"),
  panel_description: z
    .string()
    .max(4000)
    .default("Need help? Open a private support ticket below and our team will assist you."),
  welcome_message: z
    .string()
    .max(4000)
    .default(
      "Thanks for opening a ticket. Please describe what you need help with. A member of our team will be with you soon.",
    ),
  max_open_tickets: z.number().int().min(1).max(10).default(1),
});

export interface SupportPluginType extends BasePluginType {
  configSchema: typeof zSupportConfig;
}

import { GlobalPluginBlueprint, GuildPluginBlueprint } from "vety";
import { z } from "zod";
import { zSnowflake } from "./utils.js";

export const zZeppelinGuildConfig = z.strictObject({
  // From BaseConfig
  prefix: z.string().optional(),

  // Custom role-based permissions.
  // Each Discord role ID maps directly to the permissions granted by that role.
  role_permissions: z.record(zSnowflake, z.array(z.string())).optional(),

  // Optional numeric authority levels for moderation target hierarchy.
  // Highest matching role level wins; unlisted members are level 0.
  role_levels: z.record(zSnowflake, z.number().int().min(0).max(1000)).optional(),

  plugins: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Wrapper for the string type that indicates the text will be parsed as Markdown later
 */
export type TMarkdown = string;

export interface ZeppelinGuildPluginInfo {
  plugin: GuildPluginBlueprint<any, any>;
  docs: ZeppelinPluginDocs;
  autoload?: boolean;
}

export interface ZeppelinGlobalPluginInfo {
  plugin: GlobalPluginBlueprint<any, any>;
  docs: ZeppelinPluginDocs;
}

export type DocsPluginType = "stable" | "legacy" | "internal";

export interface ZeppelinPluginDocs {
  type: DocsPluginType;
  configSchema: z.ZodType;

  prettyName?: string;
  description?: TMarkdown;
  usageGuide?: TMarkdown;
  configurationGuide?: TMarkdown;
}

export interface CommandInfo {
  description?: TMarkdown;
  basicUsage?: TMarkdown;
  examples?: TMarkdown;
  usageGuide?: TMarkdown;
  parameterDescriptions?: {
    [key: string]: TMarkdown;
  };
  optionDescriptions?: {
    [key: string]: TMarkdown;
  };
}

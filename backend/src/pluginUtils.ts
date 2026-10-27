/**
 * @file Utility functions that are plugin-instance-specific (i.e. use PluginData)
 */

import {
  BitField,
  BitFieldResolvable,
  ChatInputCommandInteraction,
  CommandInteraction,
  GuildMember,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  InteractionResponse,
  Message,
  MessageCreateOptions,
  MessageEditOptions,
  MessageFlags,
  MessageFlagsString,
  ModalSubmitInteraction,
  TextBasedChannel,
} from "discord.js";
import {
  AnyPluginData,
  BasePluginData,
  CommandContext,
  ExtendedMatchParams,
  GuildPluginData,
  helpers,
  PluginConfigManager,
  Vety,
} from "vety";
import { z } from "zod";
import { isStaff } from "./staff.js";
import { Tail } from "./utils/typeUtils.js";

const { getMemberLevel } = helpers;

/**
 * Fallback target hierarchy for servers that configure role_permissions but do
 * not configure numeric role_levels. A role with a strict superset of another
 * role's permissions outranks it; incomparable/equal permission sets are peers.
 * This lets permission-configured staff act on ordinary members without
 * accidentally treating every member as numeric level 0.
 */
export function canActOnByRolePermissions(
  actorRoleIds: Iterable<string>,
  targetRoleIds: Iterable<string>,
  rolePermissions: Record<string, string[]> | undefined,
  allowSameLevel = false,
): boolean {
  const grantsFor = (roleIds: Iterable<string>): Set<string> => {
    const grants = new Set<string>();
    for (const roleId of roleIds) {
      const roleGrants = rolePermissions?.[roleId];
      if (Array.isArray(roleGrants)) {
        for (const grant of roleGrants) grants.add(grant);
      }
    }
    return grants;
  };

  const actor = grantsFor(actorRoleIds);
  const target = grantsFor(targetRoleIds);
  if (actor.has("*") && target.has("*")) return allowSameLevel;
  if (actor.has("*")) return true;
  if (target.has("*")) return false;

  const targetIsSubset = [...target].every((permission) => actor.has(permission));
  if (!targetIsSubset) return false;
  return allowSameLevel || actor.size > target.size;
}

export function canActOn(
  pluginData: GuildPluginData<any>,
  member1: GuildMember,
  member2: GuildMember,
  allowSameLevel = false,
  _allowAdmins = false,
) {
  if (member2.id === pluginData.client.user!.id) {
    return false;
  }

  // The server owner is always protected from automated moderation.
  if (member2.id === member2.guild.ownerId) {
    return false;
  }

  // Use explicit numeric ranks when the guild has configured ranks for
  // either participant. Otherwise, infer only a safe relative hierarchy from
  // the configured role_permissions grants. Without this fallback every
  // member defaults to numeric level 0, which incorrectly blocks staff from
  // acting on ordinary members even after their command permission passed.
  const fullConfig = (pluginData as any).fullConfig as {
    role_permissions?: Record<string, string[]>;
    role_levels?: Record<string, number>;
  } | undefined;
  const roleLevels = fullConfig?.role_levels;
  const actorHasConfiguredLevel = member1.roles.cache.some(
    (role) => roleLevels && role.id in roleLevels,
  );
  const targetHasConfiguredLevel = member2.roles.cache.some(
    (role) => roleLevels && role.id in roleLevels,
  );

  if (actorHasConfiguredLevel || targetHasConfiguredLevel) {
    const ourLevel = getMemberLevel(pluginData, member1);
    const memberLevel = getMemberLevel(pluginData, member2);
    return allowSameLevel ? ourLevel >= memberLevel : ourLevel > memberLevel;
  }

  return canActOnByRolePermissions(
    member1.roles.cache.keys(),
    member2.roles.cache.keys(),
    fullConfig?.role_permissions,
    allowSameLevel,
  );
}

/** Check explicit role_permissions grants using a freshly fetched guild member. */
export async function hasExplicitRolePermission(
  pluginData: AnyPluginData<any>,
  memberId: string,
  permission: string,
): Promise<boolean> {
  const rolePermissions = (pluginData as any).fullConfig?.role_permissions as Record<string, string[]> | undefined;
  const guild = (pluginData as any).guild;
  if (!rolePermissions || Object.keys(rolePermissions).length === 0 || !guild) return false;

  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member) return false;

  return member.roles.cache.some((role) => {
    const grants = rolePermissions[role.id];
    return Array.isArray(grants) && (grants.includes("*") || grants.includes(permission));
  });
}

export async function hasPermission(
  pluginData: AnyPluginData<any>,
  permission: string,
  matchParams: ExtendedMatchParams,
) {
  const fullConfig = (pluginData as any).fullConfig as { role_permissions?: Record<string, string[]> } | undefined;
  const rolePermissions = fullConfig?.role_permissions;

  // Explicit physical config is the sole source of permission grants.
  // An absent or empty role_permissions section grants nothing; numeric levels
  // and legacy/plugin defaults must never implicitly grant an action.
  const message = (matchParams as any).message;
  const member = (matchParams.member as GuildMember | null | undefined) ?? message?.member ?? undefined;
  if (!member || !rolePermissions || Object.keys(rolePermissions).length === 0) {
    return false;
  }

  for (const roleId of member.roles.cache.keys()) {
    const grants = rolePermissions[roleId];
    if (Array.isArray(grants) && (grants.includes("*") || grants.includes(permission))) {
      return true;
    }
  }

  return false;
}

export type GenericCommandSource = Message | CommandInteraction | ModalSubmitInteraction;

export function isContextInteraction(
  context: GenericCommandSource,
): context is CommandInteraction | ModalSubmitInteraction {
  return context instanceof CommandInteraction || context instanceof ModalSubmitInteraction;
}

export function isContextMessage(context: GenericCommandSource): context is Message {
  return context instanceof Message;
}

export async function getContextChannel(context: GenericCommandSource): Promise<TextBasedChannel | null> {
  if (isContextInteraction(context)) {
    return context.channel;
  }
  if (context instanceof Message) {
    return context.channel;
  }
  throw new Error("Unknown context type");
}

export function getContextChannelId(context: GenericCommandSource): string | null {
  return context.channelId;
}

export async function fetchContextChannel(context: GenericCommandSource) {
  if (!context.guild) {
    throw new Error("Missing context guild");
  }
  const channelId = getContextChannelId(context);
  if (!channelId) {
    throw new Error("Missing context channel ID");
  }
  return (await context.guild.channels.fetch(channelId))!;
}

function flagsWithEphemeral<TFlags extends string, TType extends number | bigint>(
  flags: BitFieldResolvable<TFlags, any>,
  ephemeral: boolean,
): BitFieldResolvable<TFlags | Extract<MessageFlagsString, "Ephemeral">, TType | MessageFlags.Ephemeral> {
  if (!ephemeral) {
    return flags;
  }
  return new BitField(flags).add(MessageFlags.Ephemeral) as any;
}

export type ContextResponseOptions = MessageCreateOptions & InteractionReplyOptions & InteractionEditReplyOptions;
export type ContextResponse = Message | InteractionResponse;

export async function sendContextResponse(
  context: GenericCommandSource,
  content: string | ContextResponseOptions,
  ephemeral = false,
): Promise<Message> {
  if (isContextInteraction(context)) {
    const options = { ...(typeof content === "string" ? { content: content } : content), fetchReply: true };

    if (context.replied) {
      return context.followUp({
        ...options,
        flags: flagsWithEphemeral(options.flags, ephemeral),
      });
    }
    if (context.deferred) {
      return context.editReply(options);
    }

    const replyResult = await context.reply({
      ...options,
      flags: flagsWithEphemeral(options.flags, ephemeral),
      withResponse: true,
    });
    return replyResult.resource!.message!;
  }

  const contextChannel = await fetchContextChannel(context);
  if (!contextChannel?.isSendable()) {
    throw new Error("Context channel does not exist or is not sendable");
  }

  return contextChannel.send(content);
}

export type ContextResponseEditOptions = MessageEditOptions & InteractionEditReplyOptions;

export function editContextResponse(
  response: ContextResponse,
  content: string | ContextResponseEditOptions,
): Promise<ContextResponse> {
  return response.edit(content);
}

export async function deleteContextResponse(response: ContextResponse): Promise<void> {
  await response.delete();
}

export async function getConfigForContext<TPluginData extends BasePluginData<any>>(
  config: PluginConfigManager<TPluginData>,
  context: GenericCommandSource,
): Promise<z.output<TPluginData["_pluginType"]["configSchema"]>> {
  if (context instanceof ChatInputCommandInteraction) {
    // TODO: Support for modal interactions (here and Vety)
    return config.getForInteraction(context);
  }
  const channel = await getContextChannel(context);
  const member = isContextMessage(context) && context.inGuild() ? await resolveMessageMember(context) : null;

  return config.getMatchingConfig({
    channel,
    member,
  });
}

export function getBaseUrl(pluginData: AnyPluginData<any>) {
  const vety = pluginData.getVetyInstance() as Vety;
  // @ts-expect-error
  return vety.getGlobalConfig().url;
}

export function isOwner(pluginData: AnyPluginData<any>, userId: string) {
  const vety = pluginData.getVetyInstance() as Vety;
  // @ts-expect-error
  const owners = vety.getGlobalConfig()?.owners;
  if (!owners) {
    return false;
  }

  return owners.includes(userId);
}

export const isStaffPreFilter = (_, context: CommandContext<any>) => {
  return isStaff(context.message.author.id);
};

type AnyFn = (...args: any[]) => any;

/**
 * Creates a public plugin function out of a function with pluginData as the first parameter
 */
export function mapToPublicFn<T extends AnyFn>(inputFn: T) {
  return (pluginData) => {
    return (...args: Tail<Parameters<typeof inputFn>>): ReturnType<typeof inputFn> => {
      return inputFn(pluginData, ...args);
    };
  };
}

type FnWithPluginData<TPluginData> = (pluginData: TPluginData, ...args: any[]) => any;

export function makePublicFn<TPluginData extends BasePluginData<any>, T extends FnWithPluginData<TPluginData>>(
  pluginData: TPluginData,
  fn: T,
) {
  return (...args: Tail<Parameters<T>>): ReturnType<T> => {
    return fn(pluginData, ...args);
  };
}

export function resolveMessageMember(message: Message<true>) {
  return Promise.resolve(message.member || message.guild.members.fetch(message.author.id));
}

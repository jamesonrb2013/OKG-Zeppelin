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
  PermissionsBitField,
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

export function canActOn(
  pluginData: GuildPluginData<any>,
  member1: GuildMember,
  member2: GuildMember,
  allowSameLevel = false,
  allowAdmins = false,
) {
  if (member2.id === pluginData.client.user!.id) {
    return false;
  }

  // The server owner is always protected from automated moderation.
  if (member2.id === member2.guild.ownerId) {
    return false;
  }

  const fullConfig = (pluginData as any).fullConfig;
  const rolePermissions = fullConfig?.role_permissions as Record<string, string[]> | undefined;
  const roleLevels = fullConfig?.role_levels as Record<string, number> | undefined;

  // Numeric levels are hierarchy ONLY: they never grant a command or action.
  // They only decide whether an already-authorized moderator may target a member.
  if (roleLevels && Object.keys(roleLevels).length > 0) {
    const getConfiguredLevel = (member: GuildMember) =>
      member.roles.cache.reduce((highest, role) => {
        const level = roleLevels[role.id];
        return typeof level === "number" && Number.isFinite(level) ? Math.max(highest, level) : highest;
      }, 0);

    const actorLevel = getConfiguredLevel(member1);
    const targetLevel = getConfiguredLevel(member2);
    return allowSameLevel ? actorLevel >= targetLevel : actorLevel > targetLevel;
  }

  // Backwards-compatible hierarchy when custom numeric levels are not configured.
  // Explicit role_permissions may identify staff roles, but do not grant permissions here.
  if (rolePermissions && Object.keys(rolePermissions).length > 0) {
    const moderatorHasExplicitGrant = member1.roles.cache.some((role) => {
      const grants = rolePermissions[role.id];
      return Array.isArray(grants) && (grants.includes("*") || grants.some((grant) => grant.startsWith("can_")));
    });
    const targetHasConfiguredAuthority = member2.roles.cache.some((role) => {
      const grants = rolePermissions[role.id];
      return Array.isArray(grants) && grants.length > 0;
    });

    if (moderatorHasExplicitGrant && !targetHasConfiguredAuthority) {
      return true;
    }
  }

  const ourLevel = getMemberLevel(pluginData, member1);
  const memberLevel = getMemberLevel(pluginData, member2);
  return allowSameLevel ? ourLevel >= memberLevel : ourLevel > memberLevel;
}

export async function hasPermission(
  pluginData: AnyPluginData<any>,
  permission: string,
  matchParams: ExtendedMatchParams,
) {
  const fullConfig = (pluginData as any).fullConfig as
    | { role_permissions?: Record<string, string[]> }
    | undefined;
  const rolePermissions = fullConfig?.role_permissions;

  // Explicit physical config is the sole source of permission grants.
  // An absent or empty role_permissions section grants nothing; numeric levels
  // and legacy/plugin defaults must never implicitly grant an action.
  const member = matchParams.member as GuildMember | null | undefined;
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

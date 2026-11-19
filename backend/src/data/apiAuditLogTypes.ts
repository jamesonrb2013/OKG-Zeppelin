import { ApiPermissionTypes } from "./ApiPermissionAssignments.js";

export const AuditLogEventTypes = {
  ADD_API_PERMISSION: "ADD_API_PERMISSION" as const,
  EDIT_API_PERMISSION: "EDIT_API_PERMISSION" as const,
  REMOVE_API_PERMISSION: "REMOVE_API_PERMISSION" as const,
  EDIT_CONFIG: "EDIT_CONFIG" as const,
  OWNER_STATUS_UPDATED: "OWNER_STATUS_UPDATED" as const,
  INVITE_CODE_CREATED: "INVITE_CODE_CREATED" as const,
  INVITE_CODE_REVOKED: "INVITE_CODE_REVOKED" as const,
};

export type AuditLogEventType = keyof typeof AuditLogEventTypes;

export type AddApiPermissionEventData = {
  target_id: string;
  permissions: string[];
  expires_at: string | null;
};

export type RemoveApiPermissionEventData = {
  target_id: string;
};

export interface AuditLogEventData extends Record<AuditLogEventType, unknown> {
  ADD_API_PERMISSION: {
    type: ApiPermissionTypes;
    target_id: string;
    permissions: string[];
    expires_at: string | null;
  };

  EDIT_API_PERMISSION: {
    type: ApiPermissionTypes;
    target_id: string;
    permissions: string[];
    expires_at: string | null;
  };

  REMOVE_API_PERMISSION: {
    type: ApiPermissionTypes;
    target_id: string;
  };

  EDIT_CONFIG: Record<string, never>;
  OWNER_STATUS_UPDATED: { status_text: string };
  INVITE_CODE_CREATED: { code_hint: string; target_guild_id: string; max_uses: number; expires_at: string | null };
  INVITE_CODE_REVOKED: { code_id: number; code_hint: string };
}

export type AnyAuditLogEventData = AuditLogEventData[AuditLogEventType];

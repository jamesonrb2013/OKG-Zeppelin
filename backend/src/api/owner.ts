import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import { dataSource } from "../data/dataSource.js";
import { ApiAuditLog } from "../data/ApiAuditLog.js";
import { AuditLogEventTypes } from "../data/apiAuditLogTypes.js";
import { CORE_GUILD_ID } from "../env.js";
import { isInviteAdmin } from "../staff.js";
import { redis } from "../data/redis.js";
import type { DeveloperLogEntry } from "../developerConsole.js";
import { apiTokenAuthHandlers } from "./auth.js";

const auditLog = new ApiAuditLog();
const DEVELOPER_LOG_KEY = "okg:developer:logs";
const DEVELOPER_COMMAND_QUEUE = "okg:developer:commands:queue";
const DEVELOPER_COMMAND_RESULT_PREFIX = "okg:developer:commands:result:";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type DeveloperCommand =
  | { id: string; type: "servers.list" }
  | { id: string; type: "server.info"; guildId: string }
  | { id: string; type: "server.adminroles"; guildId: string }
  | { id: string; type: "server.channels"; guildId: string }
  | { id: string; type: "user.inspect"; guildId: string; userId: string }
  | { id: string; type: "message.send"; guildId: string; channelId: string; message: string }
  | { id: string; type: "role.create"; guildId: string; name: string; give: string[]; position?: number; permissions: string[] }
  | { id: string; type: "role.assign" | "role.remove"; guildId: string; roleId: string; userId: string }
  | { id: string; type: "role.delete"; guildId: string; roleId: string; confirmed: true };

function parseDeveloperCommand(raw: string, id: string): DeveloperCommand | null {
  const command = raw.replace(/^\/+/, "").trim();
  let match = command.match(/^servers\s+list$/i);
  if (match) return { id, type: "servers.list" };
  match = command.match(/^server\s+info\s+(\d{17,20})$/i);
  if (match) return { id, type: "server.info", guildId: match[1] };
  match = command.match(/^adminroles\s+(\d{17,20})$/i);
  if (match) return { id, type: "server.adminroles", guildId: match[1] };
  match = command.match(/^server\s+channels\s+(\d{17,20})$/i);
  if (match) return { id, type: "server.channels", guildId: match[1] };
  match = command.match(/^user\s+inspect\s+(\d{17,20})\s+(\d{17,20})$/i);
  if (match) return { id, type: "user.inspect", guildId: match[1], userId: match[2] };
  match = command.match(/^message\s+send\s+(\d{17,20})\s+(\d{17,20})\s+([\s\S]+)$/i);
  if (match) return { id, type: "message.send", guildId: match[1], channelId: match[2], message: match[3].trim() };

  match = command.match(/^admin\s+role\s+(assign|remove)\s+(\d{17,20})\s+(\d{17,20})\s+(\d{17,20})$/i);
  if (match) return { id, type: match[1].toLowerCase() === "assign" ? "role.assign" : "role.remove", guildId: match[2], roleId: match[3], userId: match[4] };
  match = command.match(/^admin\s+role\s+delete\s+(\d{17,20})\s+(\d{17,20})\s+--confirm$/i);
  if (match) return { id, type: "role.delete", guildId: match[1], roleId: match[2], confirmed: true };

  const roleMatch = command.match(/^admin\s+role\s+create\s+(\d{17,20})\s+(?:"([^"]{1,100})"|([^\s]+))(.*)$/i);
  if (roleMatch) {
    const tail = roleMatch[4] || "";
    const readFlag = (name: string) => tail.match(new RegExp("(?:^|\\s)--" + name + "\\s+([^\\s]+)", "i"))?.[1] ?? "";
    const give = readFlag("give").split(",").map((value) => value.trim()).filter(Boolean);
    const permissions = readFlag("permissions").split(",").map((value) => value.trim()).filter(Boolean);
    const positionRaw = readFlag("position");
    const position = positionRaw ? Number(positionRaw) : undefined;
    if (positionRaw && (!Number.isInteger(position) || position! < 1)) return null;
    const stripped = tail.replace(/--(?:give|permissions|position)\s+[^\s]+/gi, "");
    if (/--\w+/.test(stripped)) return null;
    return { id, type: "role.create", guildId: roleMatch[1], name: roleMatch[2] || roleMatch[3], give, permissions, ...(position === undefined ? {} : { position }) };
  }
  return null;
}

function parseLog(raw: string): DeveloperLogEntry | null {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value.message !== "string" || typeof value.timestamp !== "string") return null;
    return value as DeveloperLogEntry;
  } catch { return null; }
}

export function initOwnerAPI(router: express.Router) {
  const ownerRouter = express.Router();
  ownerRouter.use(...apiTokenAuthHandlers());

  const tableReady = dataSource.query(`
    CREATE TABLE IF NOT EXISTS okg_manager_owner_settings (
      setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
      setting_value VARCHAR(128) NOT NULL DEFAULT '',
      updated_by VARCHAR(32) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const requireOwner = (req: Request, res: Response) => {
    if (isInviteAdmin(req.user!.userId)) return true;
    res.status(403).json({ error: "Only the platform owner can access these settings." });
    return false;
  };

  ownerRouter.get("/access", (req: Request, res: Response) => {
    if (!requireOwner(req, res)) return;
    res.setHeader("Cache-Control", "no-store");
    return res.json({ isOwner: true });
  });

  ownerRouter.get("/audit-log", async (req: Request, res: Response) => {
    await tableReady;
    if (!requireOwner(req, res)) return;
    const entries = await auditLog.getLatestEntries(Number(req.query.limit) || 500);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ entries });
  });

  ownerRouter.get("/presence", async (req: Request, res: Response) => {
    await tableReady;
    if (!requireOwner(req, res)) return;
    const rows = await dataSource.query(
      "SELECT setting_value AS statusText FROM okg_manager_owner_settings WHERE setting_key = 'custom_status' LIMIT 1",
    );
    res.setHeader("Cache-Control", "no-store");
    return res.json({ statusText: String(rows?.[0]?.statusText ?? "") });
  });

  ownerRouter.post("/presence", async (req: Request, res: Response) => {
    await tableReady;
    if (!requireOwner(req, res)) return;
    const statusText = typeof req.body?.statusText === "string" ? req.body.statusText.trim() : "";
    if (statusText.length > 128) return res.status(400).json({ error: "Custom status must be 128 characters or fewer." });
    await dataSource.query(
      "INSERT INTO okg_manager_owner_settings (setting_key, setting_value, updated_by) VALUES ('custom_status', ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)",
      [statusText, req.user!.userId],
    );
    await auditLog.addEntry(CORE_GUILD_ID, req.user!.userId, AuditLogEventTypes.OWNER_STATUS_UPDATED, {
      status_text: statusText,
    });
    return res.json({ ok: true, statusText });
  });


  ownerRouter.get("/console/logs", async (req: Request, res: Response) => {
    if (!requireOwner(req, res)) return;
    const requestedLimit = Number(req.query.limit) || 200;
    const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 500);
    const rawEntries = await redis.lRange(DEVELOPER_LOG_KEY, 0, 999);
    const level = String(req.query.level || "").toUpperCase();
    const source = String(req.query.source || "").toLowerCase();
    const search = String(req.query.search || "").slice(0, 200).toLowerCase();
    const entries = rawEntries.map(parseLog)
      .filter((entry): entry is DeveloperLogEntry => Boolean(entry))
      .filter((entry) => !level || level === "ALL" || entry.level === level)
      .filter((entry) => !source || source === "all" || entry.source === source)
      .filter((entry) => !search || entry.message.toLowerCase().includes(search))
      .slice(0, limit);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ entries, retained: rawEntries.length, limit });
  });

  ownerRouter.get("/console/status", async (req: Request, res: Response) => {
    if (!requireOwner(req, res)) return;
    const [botHeartbeat, redisResult, databaseResult] = await Promise.allSettled([
      redis.get("okg:developer:heartbeat:bot"), redis.ping(), dataSource.query("SELECT 1 AS ok"),
    ]);
    const botLastSeen = botHeartbeat.status === "fulfilled" && botHeartbeat.value ? Number(botHeartbeat.value) : null;
    const memory = process.memoryUsage();
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      api: { status: "online", uptimeSeconds: Math.floor(process.uptime()), memoryBytes: memory.rss },
      bot: { status: botLastSeen && Date.now() - botLastSeen < 45_000 ? "online" : "offline", lastSeen: botLastSeen ? new Date(botLastSeen).toISOString() : null },
      redis: { status: redisResult.status === "fulfilled" ? "online" : "error" },
      database: { status: databaseResult.status === "fulfilled" ? "online" : "error" },
      checkedAt: new Date().toISOString(),
    });
  });

  ownerRouter.post("/console/execute", async (req: Request, res: Response) => {
    if (!requireOwner(req, res)) return;
    const rawCommand = typeof req.body?.command === "string" ? req.body.command.trim() : "";
    if (!rawCommand || rawCommand.length > 4000) return res.status(400).json({ error: "Enter a command of 1–4,000 characters." });
    const normalized = rawCommand.replace(/^\/+/, "").trim().replace(/\s+/g, " ");
    let output = "";
    let success = true;
    let attachedLogs: DeveloperLogEntry[] | undefined;
    try {
      if (normalized === "help") {
        output = [
          "/help — Show command reference",
          "/servers list — List authorized servers",
          "/server info {serverId} — Inspect a server",
          "/adminroles {serverId} — List roles with administrative permissions",
          "/server channels {serverId} — List channel names, types, and IDs",
          "/user inspect {serverId} {userId} — Inspect a server member",
          "/message send {serverId} {channelId} {message} — Send a message as the bot",
          '/admin role create {serverId} "{name}" --give {userId,userId} --position {number} --permissions {Permission,Permission}',
          "/admin role assign {serverId} {roleId} {userId} — Assign a role",
          "/admin role remove {serverId} {roleId} {userId} — Remove a role",
          "/admin role delete {serverId} {roleId} --confirm — Permanently delete a role",
          "/bot status — Check bot heartbeat",
          "/database health — Check database connection",
          "/redis health — Check Redis connection",
          "/logs tail [1-100] — Show recent console entries",
          "Role permissions are optional; without --permissions, the new role has no elevated permissions.",
        ].join("\n");
      } else if (normalized === "bot status") {
        const heartbeat = await redis.get("okg:developer:heartbeat:bot");
        const lastSeen = heartbeat ? Number(heartbeat) : 0;
        output = lastSeen && Date.now() - lastSeen < 45_000 ? `Bot is online. Last heartbeat: ${new Date(lastSeen).toISOString()}.` : "Bot heartbeat is missing or stale. The bot may be offline.";
      } else if (normalized === "database health") {
        await dataSource.query("SELECT 1 AS ok"); output = "Database connection successful.";
      } else if (normalized === "redis health") {
        await redis.ping(); output = "Redis connection successful.";
      } else if (/^logs tail(?: \d{1,3})?$/.test(normalized)) {
        const count = Math.min(Math.max(Number(normalized.split(" ")[2] || 30), 1), 100);
        const raw = await redis.lRange(DEVELOPER_LOG_KEY, 0, count - 1);
        attachedLogs = raw.map(parseLog).filter((entry): entry is DeveloperLogEntry => Boolean(entry));
        output = `Loaded ${attachedLogs.length} recent log entr${attachedLogs.length === 1 ? "y" : "ies"}.`;
      } else {
        const id = randomUUID();
        const job = parseDeveloperCommand(rawCommand, id);
        if (!job) {
          success = false;
          output = "Unknown command or invalid arguments. Run /help.";
        } else {
          await redis.rPush(DEVELOPER_COMMAND_QUEUE, JSON.stringify(job));
          const resultKey = `${DEVELOPER_COMMAND_RESULT_PREFIX}${id}`;
          const deadline = Date.now() + 25_000;
          let result: { ok: boolean; output: string } | null = null;
          while (Date.now() < deadline) {
            const rawResult = await redis.get(resultKey);
            if (rawResult) {
              try { result = JSON.parse(rawResult); } catch { result = { ok: false, output: "The bot returned an invalid command result." }; }
              await redis.del(resultKey);
              break;
            }
            await wait(250);
          }
          if (!result) {
            success = false;
            output = "Timed out waiting for the bot. The command may still be queued; check the bot heartbeat and logs before retrying.";
          } else {
            success = result.ok;
            output = result.output;
          }
        }
      }
    } catch (error: any) {
      success = false; output = `Command failed: ${String(error?.message || error).slice(0, 500)}`;
    }
    await auditLog.addEntry(CORE_GUILD_ID, req.user!.userId, AuditLogEventTypes.DEVELOPER_COMMAND_EXECUTED, {
      command: normalized.slice(0, 200), success, result_summary: output.slice(0, 500),
    });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: success, command: normalized, output, logs: attachedLogs });
  });

  router.use("/owner", ownerRouter);
}

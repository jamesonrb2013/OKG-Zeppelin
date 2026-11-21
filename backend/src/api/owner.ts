import express, { Request, Response } from "express";
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
    const command = typeof req.body?.command === "string" ? req.body.command.trim() : "";
    if (!command || command.length > 200) return res.status(400).json({ error: "Enter a command of 1–200 characters." });
    const normalized = command.replace(/^\/+/, "").trim().replace(/\s+/g, " ");
    let output = "";
    let success = true;
    let attachedLogs: DeveloperLogEntry[] | undefined;
    try {
      if (normalized === "help") {
        output = ["/help — Show available commands", "/bot status — Check the bot heartbeat", "/database health — Check the database connection", "/redis health — Check Redis connectivity", "/logs tail [1-100] — Show recent console entries"].join("\n");
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
        success = false; output = "Unknown command. Run /help. Arbitrary shell commands are disabled.";
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

import express, { Request, Response } from "express";
import { dataSource } from "../data/dataSource.js";
import { ApiAuditLog } from "../data/ApiAuditLog.js";
import { AuditLogEventTypes } from "../data/apiAuditLogTypes.js";
import { CORE_GUILD_ID } from "../env.js";
import { isInviteAdmin } from "../staff.js";
import { apiTokenAuthHandlers } from "./auth.js";

const auditLog = new ApiAuditLog();

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

  router.use("/owner", ownerRouter);
}

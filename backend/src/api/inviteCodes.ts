import crypto from "node:crypto";
import express, { Request, Response } from "express";
import { dataSource } from "../data/dataSource.js";
import { isStaff } from "../staff.js";
import { apiTokenAuthHandlers } from "./auth.js";

const CODE_PATTERN = /^OKG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const attempts = new Map<string, { count: number; resetAt: number }>();

function makeCodePart() {
  const bytes = crypto.randomBytes(4);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function validStaff(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId || !isStaff(userId)) {
    res.status(403).json({ error: "Only OKG dashboard owners can manage invite codes." });
    return false;
  }
  return true;
}

export function initInviteCodesAPI(router: express.Router) {
  const tableReady = dataSource
    .query(`
    CREATE TABLE IF NOT EXISTS okg_manager_invite_codes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code_hash CHAR(64) NOT NULL UNIQUE,
      code_hint VARCHAR(24) NOT NULL,
      target_guild_id VARCHAR(32) NOT NULL DEFAULT '1488682722606977175',
      created_by VARCHAR(32) NOT NULL,
      max_uses INT UNSIGNED NOT NULL DEFAULT 1,
      used_count INT UNSIGNED NOT NULL DEFAULT 0,
      expires_at DATETIME NULL,
      revoked_at DATETIME NULL,
      last_used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_okg_invite_active (revoked_at, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
    .then(async () => {
      // Existing installs may have created this table before server IDs were added.
      try {
        await dataSource.query(
          "ALTER TABLE okg_manager_invite_codes ADD COLUMN target_guild_id VARCHAR(32) NOT NULL DEFAULT '1488682722606977175'",
        );
      } catch (error) {
        const dbError = error as { code?: string; message?: string };
        if (dbError.code !== "ER_DUP_FIELDNAME" && !dbError.message?.includes("Duplicate column name")) {
          throw error;
        }
      }
    })
    .catch((error) => {
      console.error("Failed to initialize OKG invite-code table:", error);
      throw error;
    });

  router.post("/invite-codes/redeem", async (req: Request, res: Response) => {
    await tableReady;
    const key = String(req.ip || req.socket.remoteAddress || "unknown");
    const now = Date.now();
    const entry = attempts.get(key);
    if (entry && entry.resetAt > now && entry.count >= 8) {
      return res.status(429).json({ error: "Too many attempts. Please wait 15 minutes and try again." });
    }
    if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    else entry.count += 1;

    const code = String(req.body?.code || "")
      .trim()
      .toUpperCase()
      .replace(/\s/g, "");
    if (!CODE_PATTERN.test(code)) {
      return res.status(400).json({ error: "That invitation code is invalid, expired, revoked, or has no uses left." });
    }

    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const matches = await dataSource.query(
      "SELECT target_guild_id AS targetGuildId FROM okg_manager_invite_codes WHERE code_hash = ? AND revoked_at IS NULL AND used_count < max_uses AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1",
      [codeHash],
    );
    const targetGuildId = String(matches?.[0]?.targetGuildId || "");
    if (!/^\d{17,20}$/.test(targetGuildId)) {
      return res.status(400).json({ error: "That invitation code is invalid, expired, revoked, or has no uses left." });
    }

    // Every invitation is locked to the server ID selected by an OKG staff member.
    const configuredInstallUrl = process.env.OKG_MANAGER_INSTALL_URL;
    const validConfiguredUrl = configuredInstallUrl?.startsWith("https://discord.com/oauth2/authorize?")
      ? configuredInstallUrl
      : null;
    let clientId = process.env.CLIENT_ID;
    if (!clientId && validConfiguredUrl) {
      try {
        clientId = new URL(validConfiguredUrl).searchParams.get("client_id") || undefined;
      } catch {
        clientId = undefined;
      }
    }
    if (!clientId) {
      return res.status(503).json({
        error: "Discord installation is not configured. Please contact an OKG administrator.",
      });
    }

    const installUrl = new URL(validConfiguredUrl || "https://discord.com/oauth2/authorize");
    installUrl.searchParams.set("client_id", clientId);
    installUrl.searchParams.set("permissions", installUrl.searchParams.get("permissions") || "8");
    installUrl.searchParams.set("scope", "bot applications.commands");
    installUrl.searchParams.set("guild_id", targetGuildId);
    installUrl.searchParams.set("disable_guild_select", "true");

    const result = await dataSource.query(
      "UPDATE okg_manager_invite_codes SET used_count = used_count + 1, last_used_at = NOW() WHERE code_hash = ? AND revoked_at IS NULL AND used_count < max_uses AND (expires_at IS NULL OR expires_at > NOW())",
      [codeHash],
    );
    if (!result?.affectedRows) {
      return res.status(400).json({ error: "That invitation code is invalid, expired, revoked, or has no uses left." });
    }

    return res.json({ ok: true, installUrl: installUrl.toString() });
  });

  const adminRouter = express.Router();
  adminRouter.use(...apiTokenAuthHandlers());
  adminRouter.get("/", async (req: Request, res: Response) => {
    await tableReady;
    if (!validStaff(req, res)) return;
    const codes = await dataSource.query(
      "SELECT id, code_hint AS codeHint, target_guild_id AS targetGuildId, max_uses AS maxUses, used_count AS usedCount, expires_at AS expiresAt, revoked_at AS revokedAt, last_used_at AS lastUsedAt, created_at AS createdAt FROM okg_manager_invite_codes ORDER BY created_at DESC LIMIT 100",
    );
    return res.json({ codes });
  });
  adminRouter.post("/", async (req: Request, res: Response) => {
    await tableReady;
    if (!validStaff(req, res)) return;
    const maxUses = Number(req.body?.maxUses ?? 1);
    const expiresInDays = Number(req.body?.expiresInDays ?? 30);
    const targetGuildId = String(req.body?.targetGuildId ?? "").trim();
    if (!/^\d{17,20}$/.test(targetGuildId)) {
      return res.status(400).json({ error: "Enter a valid Discord server ID (17–20 digits)." });
    }
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) {
      return res.status(400).json({ error: "Maximum uses must be between 1 and 100." });
    }
    if (!Number.isInteger(expiresInDays) || expiresInDays < 0 || expiresInDays > 365) {
      return res.status(400).json({ error: "Expiry must be 0 (never) or between 1 and 365 days." });
    }

    const code = `OKG-${makeCodePart()}-${makeCodePart()}-${makeCodePart()}`;
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const codeHint = `${code.slice(0, 8)}…${code.slice(-4)}`;
    const expiresAt = expiresInDays === 0 ? null : new Date(Date.now() + expiresInDays * 86400000);
    await dataSource.query(
      "INSERT INTO okg_manager_invite_codes (code_hash, code_hint, target_guild_id, created_by, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      [codeHash, codeHint, targetGuildId, req.user!.userId, maxUses, expiresAt],
    );
    return res.status(201).json({
      code,
      codeHint,
      targetGuildId,
      maxUses,
      expiresAt,
      warning: "Copy this code now. The full code is only shown once.",
    });
  });
  adminRouter.post("/:id/revoke", async (req: Request, res: Response) => {
    await tableReady;
    if (!validStaff(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid invite code." });
    const result = await dataSource.query(
      "UPDATE okg_manager_invite_codes SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = ?",
      [id],
    );
    if (!result?.affectedRows) return res.status(404).json({ error: "Invite code not found." });
    return res.json({ ok: true });
  });
  router.use("/invite-codes", adminRouter);
}

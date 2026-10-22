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
  void dataSource.query(`
    CREATE TABLE IF NOT EXISTS okg_manager_invite_codes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code_hash CHAR(64) NOT NULL UNIQUE,
      code_hint VARCHAR(24) NOT NULL,
      created_by VARCHAR(32) NOT NULL,
      max_uses INT UNSIGNED NOT NULL DEFAULT 1,
      used_count INT UNSIGNED NOT NULL DEFAULT 0,
      expires_at DATETIME NULL,
      revoked_at DATETIME NULL,
      last_used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_okg_invite_active (revoked_at, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch((error) => {
    console.error("Failed to initialize OKG invite-code table:", error);
  });

  router.post("/invite-codes/redeem", async (req: Request, res: Response) => {
    const key = String(req.ip || req.socket.remoteAddress || "unknown");
    const now = Date.now();
    const entry = attempts.get(key);
    if (entry && entry.resetAt > now && entry.count >= 8) {
      return res.status(429).json({ error: "Too many attempts. Please wait 15 minutes and try again." });
    }
    if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    else entry.count += 1;

    const code = String(req.body?.code || "").trim().toUpperCase().replace(/\\s/g, "");
    if (!CODE_PATTERN.test(code)) {
      return res.status(400).json({ error: "That invitation code is invalid, expired, revoked, or has no uses left." });
    }

    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const result = await dataSource.query(
      "UPDATE okg_manager_invite_codes SET used_count = used_count + 1, last_used_at = NOW() WHERE code_hash = ? AND revoked_at IS NULL AND used_count < max_uses AND (expires_at IS NULL OR expires_at > NOW())",
      [codeHash],
    );
    if (!result?.affectedRows) {
      return res.status(400).json({ error: "That invitation code is invalid, expired, revoked, or has no uses left." });
    }

    // The dashboard installation link is added in the Discord setup step.
    return res.json({ ok: true, message: "Invitation verified. Discord installation will be enabled in the next setup step." });
  });

  const adminRouter = express.Router();
  adminRouter.use(...apiTokenAuthHandlers());
  adminRouter.get("/", async (req: Request, res: Response) => {
    if (!validStaff(req, res)) return;
    const codes = await dataSource.query(
      "SELECT id, code_hint AS codeHint, max_uses AS maxUses, used_count AS usedCount, expires_at AS expiresAt, revoked_at AS revokedAt, last_used_at AS lastUsedAt, created_at AS createdAt FROM okg_manager_invite_codes ORDER BY created_at DESC LIMIT 100",
    );
    return res.json({ codes });
  });
  adminRouter.post("/", async (req: Request, res: Response) => {
    if (!validStaff(req, res)) return;
    const maxUses = Number(req.body?.maxUses ?? 1);
    const expiresInDays = Number(req.body?.expiresInDays ?? 30);
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
      "INSERT INTO okg_manager_invite_codes (code_hash, code_hint, created_by, max_uses, expires_at) VALUES (?, ?, ?, ?, ?)",
      [codeHash, codeHint, req.user!.userId, maxUses, expiresAt],
    );
    return res.status(201).json({
      code,
      codeHint,
      maxUses,
      expiresAt,
      warning: "Copy this code now. The full code is only shown once.",
    });
  });
  adminRouter.post("/:id/revoke", async (req: Request, res: Response) => {
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

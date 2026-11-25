import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { env } from "../env.js";
import { apiTokenAuthHandlers } from "./auth.js";

export function initModerationAPI(rootRouter: express.Router) {
  const router = express.Router();
  router.use(...apiTokenAuthHandlers());

  async function forward(path: string, method: string, body?: unknown) {
    if (!env.MODERATION_API_URL || !env.MODERATION_API_SECRET) {
      return { status: 503, data: { error: "OKG Moderation is not connected yet. Configure MODERATION_API_URL and MODERATION_API_SECRET on the OKG Manager API." } };
    }
    const response = await fetch(`${env.MODERATION_API_URL.replace(/\/$/, "")}/integrations/manager${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-OKG-Manager-Secret": env.MODERATION_API_SECRET },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => ({ error: "The moderation service returned an unreadable response." }));
    return { status: response.status, data };
  }

  router.get("/access", async (req: Request, res: Response) => {
    try { const r = await forward(`/access?actorDiscordId=${encodeURIComponent(req.user!.userId)}`, "GET"); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.get("/cases", async (req: Request, res: Response) => {
    try { const r = await forward(`/cases?actorDiscordId=${encodeURIComponent(req.user!.userId)}`, "GET"); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.post("/cases", async (req: Request, res: Response) => {
    try { const r = await forward("/cases", "POST", { ...req.body, requestId: req.body?.requestId || randomUUID(), actorDiscordId: req.user!.userId }); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.get("/edit-requests", async (req: Request, res: Response) => {
    try { const r = await forward(`/edit-requests?actorDiscordId=${encodeURIComponent(req.user!.userId)}`, "GET"); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.post("/edit-requests/:id/review", async (req: Request, res: Response) => {
    try { const r = await forward(`/edit-requests/${encodeURIComponent(req.params.id)}/review`, "POST", { ...req.body, actorDiscordId: req.user!.userId }); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.get("/appeals", async (req: Request, res: Response) => {
    try { const r = await forward(`/appeals?actorDiscordId=${encodeURIComponent(req.user!.userId)}`, "GET"); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.post("/appeals/:id/review", async (req: Request, res: Response) => {
    try { const r = await forward(`/appeals/${encodeURIComponent(req.params.id)}/review`, "POST", { ...req.body, actorDiscordId: req.user!.userId }); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.get("/policy", async (req: Request, res: Response) => {
    try { const r = await forward(`/policy?actorDiscordId=${encodeURIComponent(req.user!.userId)}`, "GET"); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.put("/policy/draft", async (req: Request, res: Response) => {
    try { const r = await forward("/policy/draft", "PUT", { ...req.body, actorDiscordId: req.user!.userId }); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.post("/policy/activate", async (req: Request, res: Response) => {
    try { const r = await forward("/policy/activate", "POST", { actorDiscordId: req.user!.userId }); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.post("/policy/deactivate", async (req: Request, res: Response) => {
    try { const r = await forward("/policy/deactivate", "POST", { actorDiscordId: req.user!.userId }); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.get("/action-reversals", async (req: Request, res: Response) => {
    try { const r = await forward(`/action-reversals?actorDiscordId=${encodeURIComponent(req.user!.userId)}`, "GET"); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.post("/action-reversals/:id/review", async (req: Request, res: Response) => {
    try { const r = await forward(`/action-reversals/${encodeURIComponent(req.params.id)}/review`, "POST", { ...req.body, actorDiscordId: req.user!.userId }); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.get("/audit", async (req: Request, res: Response) => {
    try { const r = await forward(`/audit?actorDiscordId=${encodeURIComponent(req.user!.userId)}`, "GET"); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.get("/cases/:caseId", async (req: Request, res: Response) => {
    try { const r = await forward(`/cases/${encodeURIComponent(req.params.caseId)}?actorDiscordId=${encodeURIComponent(req.user!.userId)}`, "GET"); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  router.patch("/cases/:caseId", async (req: Request, res: Response) => {
    try { const r = await forward(`/cases/${encodeURIComponent(req.params.caseId)}`, "PATCH", { ...req.body, actorDiscordId: req.user!.userId }); return res.status(r.status).json(r.data); }
    catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : "Moderation service unavailable." }); }
  });
  rootRouter.use("/moderation", router);
}

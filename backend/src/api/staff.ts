import express, { Request, Response } from "express";
import { isInviteAdmin } from "../staff.js";
import { apiTokenAuthHandlers } from "./auth.js";

export function initStaff(router: express.Router) {
  const staffRouter = express.Router();
  staffRouter.use(...apiTokenAuthHandlers());

  staffRouter.get("/status", (req: Request, res: Response) => {
    const userIsStaff = isInviteAdmin(req.user!.userId);
    res.setHeader("Cache-Control", "no-store");
    res.json({ isStaff: userIsStaff });
  });

  router.use("/staff", staffRouter);
}

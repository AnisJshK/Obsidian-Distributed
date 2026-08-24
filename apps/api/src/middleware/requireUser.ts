import type { Request, Response, NextFunction } from "express";
import { verifySession } from "../lib/auth";
import { prisma,User } from "@scheduler/database";



export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.session;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const payload = verifySession(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session" });

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return res.status(401).json({ error: "User not found" });

  req.user = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
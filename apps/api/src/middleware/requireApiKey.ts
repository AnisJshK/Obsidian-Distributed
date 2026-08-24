import type { Request, Response, NextFunction } from "express";
import { hashApiKey } from "../lib/apikey";
import { prisma } from "@scheduler/database";

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing API key" });

  const raw = header.slice(7);
  const hash = hashApiKey(raw);

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hash }, include: { project: true } });
  if (!key) return res.status(401).json({ error: "Invalid API key" });
  if (key.expiresAt && key.expiresAt < new Date()) return res.status(401).json({ error: "API key expired" });

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });

  req.project = key.project;
  next();
}
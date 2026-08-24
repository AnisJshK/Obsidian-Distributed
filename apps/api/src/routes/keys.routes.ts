import { Router } from "express";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@scheduler/database";
import { validate } from "../middleware/validate.middleware";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export const keysRouter = Router();

function generateApiKey() {
  const rawSecret = randomBytes(24).toString("hex");
  const apiKey = `djs_live_${rawSecret}`;
  const prefix = apiKey.slice(0, 12);
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  return { apiKey, prefix, keyHash };
}

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().positive().optional(),
});

keysRouter.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { projectId: req.project!.id },
      select: { id: true, name: true, prefix: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: keys });
  } catch (error) { next(error); }
});

keysRouter.post("/", validate(CreateApiKeySchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { name, expiresInDays } = req.body;
    const { apiKey, prefix, keyHash } = generateApiKey();
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

    const createdKey = await prisma.apiKey.create({
      data: { projectId: req.project!.id, name, prefix, keyHash, expiresAt },
    });

    res.status(201).json({
      success: true,
      data: { id: createdKey.id, name: createdKey.name, prefix: createdKey.prefix, apiKey, expiresAt: createdKey.expiresAt },
    });
  } catch (error) { next(error); }
});

keysRouter.delete("/:id", async (req: AuthenticatedRequest, res, next) => {
  try {
    const existing = await prisma.apiKey.findFirst({ where: { id: req.params.id, projectId: req.project!.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "API Key not found or does not belong to this project." } });
    }
    await prisma.apiKey.delete({ where: { id: existing.id } });
    res.json({ success: true, message: "API Key revoked successfully" });
  } catch (error) { next(error); }
});
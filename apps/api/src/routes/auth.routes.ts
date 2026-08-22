// apps/api/src/routes/auth.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@scheduler/database";
import { validate } from "../middleware/validate.middleware";
import { randomBytes, createHash } from "node:crypto";

const CreateApiKeySchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().positive().optional(),
});

export const authRouter = Router();

// 1. GET /api/auth/keys?projectId=... - List all API keys for a project
authRouter.get("/keys", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      return res.status(400).json({ success: false, error: { message: "projectId query param is required" } });
    }

    const keys = await prisma.apiKey.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: keys });
  } catch (error) {
    next(error);
  }
});

// 2. POST /api/auth/keys - Generate a new secure API Key
authRouter.post(
  "/keys",
  validate(CreateApiKeySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId, name, expiresInDays } = req.body;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: `Project ${projectId} not found.` },
        });
      }

      const rawSecret = randomBytes(24).toString("hex");
      const apiKey = `djs_live_${rawSecret}`;
      const prefix = apiKey.slice(0, 12);
      const keyHash = createHash("sha256").update(apiKey).digest("hex");

      let expiresAt: Date | null = null;
      if (expiresInDays) {
        expiresAt = new Date(Date.now() + expiresInDays * 86400000);
      }

      const createdKey = await prisma.apiKey.create({
        data: {
          projectId,
          name,
          prefix,
          keyHash,
          expiresAt,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          id: createdKey.id,
          name: createdKey.name,
          prefix: createdKey.prefix,
          apiKey, // Returned ONCE upon generation
          expiresAt: createdKey.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 3. DELETE /api/auth/keys/:id - Revoke an API Key
authRouter.delete("/keys/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.apiKey.delete({ where: { id } });
    res.json({ success: true, message: "API Key revoked successfully" });
  } catch (error) {
    next(error);
  }
});
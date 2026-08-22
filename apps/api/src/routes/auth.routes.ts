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

// Generate a new secure API Key for a project
authRouter.post(
  "/keys",
  validate(CreateApiKeySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId, name, expiresInDays } = req.body;

      // 1. Check if project exists
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: `Project ${projectId} not found.` },
        });
      }

      // 2. Generate cryptographically random key: `djs_live_<random_bytes>`
      const rawSecret = randomBytes(24).toString("hex");
      const apiKey = `djs_live_${rawSecret}`;
      const prefix = apiKey.slice(0, 12); // "djs_live_xxxx"
      const keyHash = createHash("sha256").update(apiKey).digest("hex");

      let expiresAt: Date | null = null;
      if (expiresInDays) {
        expiresAt = new Date(Date.now() + expiresInDays * 86400000);
      }

      const createdKey = await prisma.apiKey.create({
        data: {
          projectId,
          name,
          prefix, // matches Prisma schema column 'prefix'
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
          apiKey, // Raw token returned ONLY once upon creation
          expiresAt: createdKey.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
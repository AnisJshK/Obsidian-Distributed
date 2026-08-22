// apps/api/src/routes/auth.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@scheduler/database";
import { validate } from "../middleware/validate.middleware";
import {
  AuthenticatedRequest,
  requireApiKey,
} from "../middleware/auth.middleware";
import { randomBytes, createHash } from "node:crypto";

const CreateApiKeySchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().positive().optional(),
});

const RegisterProjectSchema = z.object({
  projectName: z.string().min(1).max(100),
});

const VerifyKeySchema = z.object({
  apiKey: z.string().min(1),
});

export const authRouter = Router();

// Helper to generate key + hash
function generateApiKey() {
  const rawSecret = randomBytes(24).toString("hex");
  const apiKey = `djs_live_${rawSecret}`;
  const prefix = apiKey.slice(0, 12);
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  return { apiKey, prefix, keyHash };
}

// ----------------------------------------------------
// 1. POST /api/auth/register-project - Onboard New Workspace
// ----------------------------------------------------
authRouter.post(
  "/register-project",
  validate(RegisterProjectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectName } = req.body;
      const { apiKey, prefix, keyHash } = generateApiKey();
      const trimmedName = projectName.trim();
      const generatedSlug = `${trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")}-${randomBytes(3).toString("hex")}`;

      const result = await prisma.$transaction(async (tx) => {
        let owner = await tx.user.findFirst();
        if (!owner) {
          const placeholderHash = createHash("sha256")
            .update(randomBytes(16).toString("hex"))
            .digest("hex");
          owner = await tx.user.create({
            data: {
              email: `admin-${randomBytes(4).toString("hex")}@example.com`,
              name: "Workspace Admin",
              passwordHash: placeholderHash,
            },
          });
        }
        // 1. Create Project
        const project = await tx.project.create({
          data: {
            name: trimmedName,
            slug: generatedSlug,
            ownerId: owner.id, // or owner: { connect: { id: owner.id } }
          },
        });

        // 2. Provision Default Queue
        await tx.queue.create({
          data: {
            name: "default",
            projectId: project.id,
          },
        });

        // 3. Issue Root Admin Key
        const createdKey = await tx.apiKey.create({
          data: {
            projectId: project.id,
            name: "Default Admin Key",
            prefix,
            keyHash,
          },
        });

        return { project, createdKey, apiKey };
      });

      res.status(201).json({
        success: true,
        data: {
          projectId: result.project.id,
          projectName: result.project.name,
          apiKey: result.apiKey,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ----------------------------------------------------
// 2. POST /api/auth/verify - Validate Key & Return Context
// ----------------------------------------------------
authRouter.post(
  "/verify",
  validate(VerifyKeySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { apiKey } = req.body;
      const keyHash = createHash("sha256").update(apiKey.trim()).digest("hex");

      const foundKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: { project: true },
      });

      if (!foundKey) {
        return res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid API key." },
        });
      }

      if (foundKey.expiresAt && foundKey.expiresAt < new Date()) {
        return res.status(401).json({
          success: false,
          error: { code: "KEY_EXPIRED", message: "This API key has expired." },
        });
      }

      res.json({
        success: true,
        data: {
          projectId: foundKey.projectId,
          token: apiKey.trim(),
          project: foundKey.project,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ----------------------------------------------------
// 3. GET /api/auth/projects - List projects (for bootstrapping)
// ----------------------------------------------------
authRouter.get(
  "/projects",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const projects = await prisma.project.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      res.json({ success: true, data: projects });
    } catch (error) {
      next(error);
    }
  },
);

// ----------------------------------------------------
// 4. GET /api/auth/session - Session Check
// ----------------------------------------------------
authRouter.get(
  "/session",
  requireApiKey,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: { project: req.project } });
  },
);

// ----------------------------------------------------
// 5. GET /api/auth/keys - List API Keys (Project Scoped)
// ----------------------------------------------------
authRouter.get(
  "/keys",
  requireApiKey,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const projectId = req.project!.id;

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
  },
);

// ----------------------------------------------------
// 6. POST /api/auth/keys - Generate a New Scoped Key
// ----------------------------------------------------
// apps/api/src/routes/auth.routes.ts

// REMOVE or comment out public project listing:
// authRouter.get("/projects", ...);

// Protect standalone key creation with existing authentication:
authRouter.post(
  "/keys",
  requireApiKey,
  validate(CreateApiKeySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const projectId = req.project!.id; // Derived from authenticated tenant
      const { name, expiresInDays } = req.body;

      const { apiKey, prefix, keyHash } = generateApiKey();

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
          apiKey,
          expiresAt: createdKey.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ----------------------------------------------------
// 7. DELETE /api/auth/keys/:id - Safely Revoke Key (Scoped)
// ----------------------------------------------------
authRouter.delete(
  "/keys/:id",
  requireApiKey,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const projectId = req.project!.id;

      // Verify key belongs to the authenticated project before deleting
      const existing = await prisma.apiKey.findFirst({
        where: { id, projectId },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "API Key not found or does not belong to this project.",
          },
        });
      }

      await prisma.apiKey.delete({ where: { id } });
      res.json({ success: true, message: "API Key revoked successfully" });
    } catch (error) {
      next(error);
    }
  },
);

// apps/api/src/routes/auth.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { hashPassword, verifyPassword } from "../lib/password"; // new small file, Bun.password wrapper
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@scheduler/database";
import { validate } from "../middleware/validate.middleware";
import {
  AuthenticatedRequest,
  requireApiKey,
  requireUser,
} from "../middleware/auth.middleware";
import { randomBytes, createHash } from "node:crypto";
import { UserScalarFieldEnum } from "../../../../packages/database/src/generated/internal/prismaNamespace";

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

const RegisterUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
const isProd = process.env.NODE_ENV === "production";

function issueSession(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 7 * 86400000,
  });
}

authRouter.post("/register", validate(RegisterUserSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, error: { code: "EMAIL_TAKEN", message: "Email already registered." } });
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, passwordHash, name } });
    issueSession(res, user.id);
    res.status(201).json({ success: true, data: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) { next(error); }
});

authRouter.post("/login", validate(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid credentials." } });
    }
    issueSession(res, user.id);
    res.json({ success: true, data: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) { next(error); }
});



authRouter.post(
  "/register-project",
  requireUser,
  validate(RegisterProjectSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { projectName } = req.body;
      const ownerId = req.user!.id;
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
            ownerId: ownerId, // or owner: { connect: { id: owner.id } }
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

// apps/api/src/routes/auth.routes.ts

authRouter.post("/logout", (_req: Request, res: Response) => {
   const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("session", { httpOnly: true, sameSite: isProd ? "none" : "lax", secure: isProd });
  res.json({ success: true, message: "Logged out." });
});

// GET /api/auth/me — Verify current user session is valid
authRouter.get(
  "/me",
  requireUser,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: {
        id: req.user!.id,
        email: req.user!.email,
        name: req.user!.name,
        role: req.user!.role,
      },
    });
  },
);

authRouter.get(
  "/session",
  requireApiKey,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: { project: req.project } });
  },
);


// apps/api/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { prisma, Project, User } from "@scheduler/database";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthenticatedRequest extends Request {
  project?:Project 
  apiKey?: {
    id: string;
    name: string;
  },
  user?:User
}

export async function requireUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.session;
  if (!token) {
    return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Login required." } });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new Error("no user");
    req.user = user;
    const requestedProjectId = req.headers["x-project-id"] as string | undefined;
    const project = await prisma.project.findFirst({
      where: requestedProjectId
        ? { id: requestedProjectId, ownerId: user.id }
        : { ownerId: user.id },
    });
    if (requestedProjectId && !project) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Project is not owned by this user." },
      });
    }
    req.project = project || undefined;
    next();
  } catch {
    return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired session." } });
  }
}

export async function requireApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const rawKey =
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined) || (req.headers["x-api-key"] as string);

    if (!rawKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing API key. Use an Authorization Bearer token or X-API-Key header.",
        },
      });
    }

    // SHA-256 hash to look up against the stored hash
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        OR: [{ expiresAt: { gt: new Date() } }, { expiresAt: null }],
      },
      include: {
        project: {
          select: {
            id: true,
            ownerId: true,
            name: true,
          },
        },
      },
    });

    if (!apiKeyRecord) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Invalid or expired API Key.",
        },
      });
    }

    // Attach project and key metadata to the request
    req.project = apiKeyRecord.project as unknown as Project;
    req.apiKey = { id: apiKeyRecord.id, name: apiKeyRecord.name };

    next();
  } catch (error) {
    next(error);
  }
}

export async function requireProjectAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const bearerOrHeaderKey =
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined) || (req.headers["x-api-key"] as string);

  if (bearerOrHeaderKey) {
    return requireApiKey(req, res, next);
  }

  return requireUser(req, res, next);
}
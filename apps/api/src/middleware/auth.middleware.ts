// apps/api/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "@scheduler/database";
import { createHash } from "node:crypto";

export interface AuthenticatedRequest extends Request {
  project?: {
    id: string;
    ownerId: string;
    name: string;
  };
  apiKey?: {
    id: string;
    name: string;
  };
}

export async function requireApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const rawKey = req.headers["x-api-key"] as string;

    if (!rawKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing 'X-API-Key' header in request.",
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
    req.project = apiKeyRecord.project;
    req.apiKey = { id: apiKeyRecord.id, name: apiKeyRecord.name };

    next();
  } catch (error) {
    next(error);
  }
}
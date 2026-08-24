import { Router } from "express";
import { z } from "zod";
import { prisma } from "@scheduler/database";
import { validate } from "../middleware/validate.middleware";
import { requireUser, AuthenticatedRequest } from "../middleware/auth.middleware";

export const projectsRouter = Router();

// GET /api/projects — list projects the logged-in user owns
projectsRouter.get("/", requireUser, async (req: AuthenticatedRequest, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { ownerId: req.user!.id },
      select: { id: true, name: true, slug: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: projects });
  } catch (error) { next(error); }
});

// GET /api/projects/:id — single project detail, ownership-checked
projectsRouter.get("/:id", requireUser, async (req: AuthenticatedRequest, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
      include: { queues: true, apiKeys: { select: { id: true, name: true, prefix: true, createdAt: true, expiresAt: true } } },
    });
    if (!project) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Project not found." } });
    }
    res.json({ success: true, data: project });
  } catch (error) { next(error); }
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

// PATCH /api/projects/:id
projectsRouter.patch("/:id", requireUser, validate(UpdateProjectSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const existing = await prisma.project.findFirst({ where: { id: req.params.id, ownerId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Project not found." } });
    }
    const updated = await prisma.project.update({ where: { id: existing.id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

// DELETE /api/projects/:id
projectsRouter.delete("/:id", requireUser, async (req: AuthenticatedRequest, res, next) => {
  try {
    const existing = await prisma.project.findFirst({ where: { id: req.params.id, ownerId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Project not found." } });
    }
    await prisma.project.delete({ where: { id: existing.id } }); // cascades to queues/keys/jobs per your schema
    res.json({ success: true, message: "Project deleted." });
  } catch (error) { next(error); }
});
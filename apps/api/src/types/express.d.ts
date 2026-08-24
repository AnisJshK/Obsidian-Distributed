import type { User, Project } from "@scheduler/database";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      project?: Project;
    }
  }
}
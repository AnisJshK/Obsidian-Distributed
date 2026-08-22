import path from "node:path";
import dotenv from "dotenv";

// Load from current working directory or traverse up to root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

declare global {
  // eslint-disable-next-line no-var
  var __scheduler_prisma__: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __scheduler_pg_pool__: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not defined.");
}

const pool =
  globalThis.__scheduler_pg_pool__ ??
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalThis.__scheduler_prisma__ ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__scheduler_prisma__ = prisma;
  globalThis.__scheduler_pg_pool__ = pool;
}

export * from "./generated/client";
export * from "./generated/enums";
export * from "./generated/models";
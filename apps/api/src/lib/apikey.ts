import { randomBytes, createHash } from "crypto";

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString("hex");
  const prefix = "sk_live_" + randomBytes(4).toString("hex");
  const raw = `${prefix}_${secret}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}